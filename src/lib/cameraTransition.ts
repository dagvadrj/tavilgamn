import { PerspectiveCamera, Quaternion, Vector3 } from "three";
import type { NavigationControls } from "./plannerCamera";
export interface CameraPose {
    position: Vector3;
    target: Vector3;
    up: Vector3;
    fov: number;
    far: number;
}
export function cameraPose(camera: PerspectiveCamera, target: Vector3): CameraPose {
    return { position: camera.position.clone(), target: target.clone(), up: camera.up.clone(), fov: camera.fov, far: camera.far };
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
export function beginCameraTransition(camera: PerspectiveCamera, from: CameraPose, to: CameraPose, reducedMotion = false) {
    transitions.delete(camera);
    if (reducedMotion) {
        camera.position.copy(to.position);
        camera.up.copy(to.up);
        camera.fov = to.fov;
        camera.far = to.far;
        camera.lookAt(to.target);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        return false;
    }
    transitions.set(camera, { from, to, elapsed: 0, duration: Math.min(2, Math.max(.35, from.position.distanceTo(to.position) * .09)) });
    camera.position.copy(from.position);
    camera.up.copy(from.up);
    camera.fov = from.fov;
    camera.lookAt(from.target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    return true;
}
/** Time-based, focus-centred interpolation avoids cutting through the room on a view change. */
export function advanceCameraTransition(camera: PerspectiveCamera, controls: NavigationControls | undefined, delta: number) {
    const state = transitions.get(camera);
    if (!state)
        return false;
    state.elapsed += Math.max(0, delta);
    const t = Math.min(1, state.elapsed / state.duration), eased = 1 - (1 - t) ** 3;
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
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    if (controls) {
        controls.target.copy(target);
        controls.update();
    }
    if (t === 1)
        transitions.delete(camera);
    return t < 1;
}
