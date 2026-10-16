import { PerspectiveCamera, Quaternion, Vector3 } from "three";
import type { NavigationControls } from "./plannerCamera";
export interface CameraPose {
    position: Vector3;
    target: Vector3;
    up: Vector3;
    fov: number;
    far: number;
    zoom: number;
}
export function cameraPose(camera: PerspectiveCamera, target: Vector3): CameraPose {
    return { position: camera.position.clone(), target: target.clone(), up: camera.up.clone(), fov: camera.fov, far: camera.far, zoom: camera.zoom };
}
/** Clear manual inertia without letting controls alter the requested pose. */
export function applyCameraPose(camera: PerspectiveCamera, pose: CameraPose, controls?: NavigationControls) {
    const write = () => {
        camera.position.copy(pose.position);
        camera.up.copy(pose.up);
        camera.fov = pose.fov;
        camera.far = pose.far;
        camera.zoom = pose.zoom;
        controls?.target.copy(pose.target);
        camera.lookAt(pose.target);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
    };
    write();
    if (controls) {
        const damping = controls.enableDamping;
        controls.enableDamping = false;
        try { controls.update(); }
        finally { controls.enableDamping = damping; write(); }
    }
}
const transitions = new WeakMap<PerspectiveCamera, {
    from: CameraPose;
    to: CameraPose;
    elapsed: number;
    duration: number;
}>();
export function cancelCameraTransition(camera: PerspectiveCamera) { transitions.delete(camera); }
export function shiftCameraTransition(camera: PerspectiveCamera, shift: Vector3) {
    const state = transitions.get(camera);
    if (state)
        for (const pose of [state.from, state.to]) {
            pose.position.add(shift);
            pose.target.add(shift);
        }
}
export function beginCameraTransition(camera: PerspectiveCamera, from: CameraPose, to: CameraPose, reducedMotion = false, controls?: NavigationControls) {
    transitions.delete(camera);
    if (reducedMotion) {
        applyCameraPose(camera, to, controls);
        return false;
    }
    const clone = (pose: CameraPose) => ({ ...pose, position: pose.position.clone(), target: pose.target.clone(), up: pose.up.clone() });
    transitions.set(camera, { from: clone(from), to: clone(to), elapsed: 0, duration: Math.min(2, Math.max(.35, from.position.distanceTo(to.position) * .09)) });
    applyCameraPose(camera, from, controls);
    return true;
}
/** Time-based, focus-centred interpolation avoids cutting through the room on a view change. */
export function advanceCameraTransition(camera: PerspectiveCamera, controls: NavigationControls | undefined, delta: number) {
    const state = transitions.get(camera);
    if (!state)
        return false;
    state.elapsed += Number.isNaN(delta) ? 0 : Math.max(0, delta);
    const t = Math.min(1, state.elapsed / state.duration), eased = 1 - (1 - t) ** 3;
    if (t === 1) {
        applyCameraPose(camera, state.to, controls);
        transitions.delete(camera);
        return false;
    }
    const target = state.from.target.clone().lerp(state.to.target, eased);
    const start = state.from.position.clone().sub(state.from.target), end = state.to.position.clone().sub(state.to.target);
    if (start.lengthSq() && end.lengthSq()) {
        const rotation = new Quaternion().setFromUnitVectors(start.clone().normalize(), end.clone().normalize());
        const arc = new Quaternion().slerp(rotation, eased);
        const radius = start.length() * (1 - eased) + end.length() * eased;
        camera.position.copy(start.normalize().applyQuaternion(arc).multiplyScalar(radius)).add(target);
    }
    else
        camera.position.copy(state.from.position).lerp(state.to.position, eased);
    const upRotation = new Quaternion().setFromUnitVectors(state.from.up.clone().normalize(), state.to.up.clone().normalize());
    camera.up.copy(state.from.up).applyQuaternion(new Quaternion().slerp(upRotation, eased)).normalize();
    camera.fov = state.from.fov + (state.to.fov - state.from.fov) * eased;
    camera.far = Math.max(state.from.far, state.to.far);
    camera.zoom = state.from.zoom + (state.to.zoom - state.from.zoom) * eased;
    applyCameraPose(camera, cameraPose(camera, target), controls);
    return true;
}
