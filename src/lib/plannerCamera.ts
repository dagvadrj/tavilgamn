import { MathUtils, MOUSE, PerspectiveCamera, Vector3 } from "three";

export type CameraAction = "zoom-in" | "zoom-out" | "fit" | "top" | "front" |
  "rotate-left" | "rotate-right" | "pan-left" | "pan-right" | "pan-up" | "pan-down";
export type CameraRequest = { id: number; action: CameraAction };
export interface CameraBounds {
  width: number; depth: number; height: number; centerX: number; centerZ: number;
}
export interface NavigationControls {
  target: Vector3; update: () => void; minDistance?: number; maxDistance?: number;
}
type MouseControls = { domElement?: HTMLElement; mouseButtons: Partial<Record<"LEFT" | "MIDDLE" | "RIGHT", MOUSE>> };

/** Blender-style desktop input, leaving the controls' touch mapping unchanged. */
export function bindBlenderMouse(controls: MouseControls, element: HTMLElement, plan = false) {
  const previous = { ...controls.mouseButtons };
  controls.mouseButtons.LEFT = undefined; // Left click/drag belongs to object selection and movement.
  controls.mouseButtons.MIDDLE = plan ? MOUSE.PAN : MOUSE.ROTATE;
  controls.mouseButtons.RIGHT = MOUSE.PAN;
  const prepare = (event: PointerEvent) => {
    if (event.button !== 1 || event.pointerType === "touch") return;
    controls.mouseButtons.MIDDLE = event.ctrlKey || event.metaKey ? MOUSE.DOLLY
      : plan && !event.shiftKey ? MOUSE.PAN : MOUSE.ROTATE;
    // OrbitControls handles Shift + ROTATE as PAN; Ctrl + MMB uses DOLLY.
    event.preventDefault(); // Avoid the browser's middle-button autoscroll.
  };
  element.addEventListener("pointerdown", prepare, true);
  return () => {
    element.removeEventListener("pointerdown", prepare, true);
    controls.mouseButtons = previous;
  };
}

/** Changes only the viewing camera, never a saved design or furniture position. */
export function navigateCamera(camera: PerspectiveCamera, controls: NavigationControls,
  action: CameraAction, bounds: CameraBounds, aspect: number, plan = false) {
  const target = controls.target;
  const offset = camera.position.clone().sub(target);
  const min = controls.minDistance ?? .8, max = controls.maxDistance ?? 150;
  if (action === "zoom-in" || action === "zoom-out") {
    const distance = MathUtils.clamp(offset.length() * (action === "zoom-in" ? .8 : 1.25), min, max);
    if (offset.lengthSq() === 0) offset.set(0, 1, .001);
    camera.position.copy(target).add(offset.normalize().multiplyScalar(distance));
  } else if (action.startsWith("pan-")) {
    camera.updateMatrixWorld();
    const horizontal = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const vertical = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    horizontal.y = 0; vertical.y = 0;
    if (vertical.lengthSq() < .0001) vertical.set(0, 0, -1);
    const shift = (action === "pan-left" || action === "pan-right" ? horizontal : vertical)
      .normalize().multiplyScalar(Math.max(.1, offset.length() * .08) *
        (action === "pan-left" || action === "pan-down" ? -1 : 1));
    target.add(shift); camera.position.add(shift);
  } else if (action === "rotate-left" || action === "rotate-right") {
    if (plan) return;
    offset.applyAxisAngle(new Vector3(0, 1, 0), action === "rotate-left" ? Math.PI / 4 : -Math.PI / 4);
    camera.position.copy(target).add(offset);
  } else {
    const top = plan || action === "top";
    target.set(bounds.centerX, top ? 0 : bounds.height * .4, bounds.centerZ);
    camera.up.set(0, plan ? 0 : 1, plan ? -1 : 0);
    const halfFov = MathUtils.degToRad(camera.fov / 2);
    const horizontalFov = Math.atan(Math.tan(halfFov) * Math.max(.1, aspect));
    const radius = Math.hypot(bounds.width / 2, bounds.depth / 2, bounds.height * .6);
    const distance = top
      ? Math.max(bounds.depth + 1, (bounds.width + 1) / Math.max(.1, aspect)) / (2 * Math.tan(halfFov))
      : radius / Math.sin(Math.min(halfFov, horizontalFov)) * 1.12;
    const direction = top ? new Vector3(0, 1, .001) : action === "front"
      ? new Vector3(0, .12, 1) : new Vector3(.8, .68, .82);
    camera.position.copy(target).add(direction.normalize().multiplyScalar(MathUtils.clamp(distance, min, max)));
    camera.far = Math.max(300, distance * 4);
  }
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  controls.update();
}
