import { MathUtils, Plane, Raycaster, Vector2, Vector3, type PerspectiveCamera } from "three";
import type { OrbitControls } from "three-stdlib";

export const SCENE_NAVIGATION_START = "scene-navigation-start";
const gestures = new WeakSet<HTMLElement>();
export const isSceneNavigationGesture = (element: HTMLElement) => gestures.has(element);
type Point = { x: number; y: number };

/** Keep the same world point beneath a moving pinch midpoint, including at zoom limits. */
export function pinchCamera(camera: PerspectiveCamera, controls: OrbitControls, element: HTMLElement,
  before: Point, after: Point, scale: number, plan = false) {
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height || !Number.isFinite(scale) || scale <= 0) return;
  camera.updateMatrixWorld();
  const normal = plan ? new Vector3(0, 1, 0) : camera.getWorldDirection(new Vector3());
  const plane = new Plane().setFromNormalAndCoplanarPoint(normal, controls.target);
  const ray = new Raycaster();
  const hit = (point: Point) => {
    ray.setFromCamera(new Vector2((point.x - rect.left) / rect.width * 2 - 1,
      -(point.y - rect.top) / rect.height * 2 + 1), camera);
    return ray.ray.intersectPlane(plane, new Vector3());
  };
  const anchor = hit(before);
  if (!anchor) return;
  const offset = camera.position.clone().sub(controls.target);
  const distance = MathUtils.clamp(offset.length() * scale, controls.minDistance, controls.maxDistance);
  if (offset.lengthSq() < 1e-12) return;
  camera.position.copy(controls.target).add(offset.normalize().multiplyScalar(distance));
  controls.update();
  camera.updateMatrixWorld();
  const moved = hit(after);
  if (!moved) return;
  const shift = anchor.sub(moved);
  camera.position.add(shift);
  controls.target.add(shift);
  camera.updateMatrixWorld();
  controls.dispatchEvent({ type: "change", target: controls });
}

/** Native wheel-to-cursor plus a two-finger pinch/pan anchored to the fingers. */
export function bindCursorNavigation(controls: OrbitControls, element: HTMLElement,
  allowed: () => boolean = () => true, plan = false) {
  const document = element.ownerDocument;
  const previous = { zoomToCursor: controls.zoomToCursor, two: controls.touches.TWO };
  const points = new Map<number, Point>();
  let active = false, saved: { damping: boolean; autoRotate: boolean } | undefined;
  controls.zoomToCursor = true;
  // This binding owns two-finger input; native one-finger orbit/pan still works.
  controls.touches.TWO = undefined;
  const pair = () => {
    const [a, b] = [...points.values()];
    return { midpoint: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.hypot(a.x - b.x, a.y - b.y) };
  };
  const finish = () => {
    if (!active) return;
    active = false;
    gestures.delete(element);
    if (saved) { controls.enableDamping = saved.damping; controls.autoRotate = saved.autoRotate; saved = undefined; }
    controls.dispatchEvent({ type: "end", target: controls });
  };
  const down = (event: PointerEvent) => {
    if (event.pointerType !== "touch" || !allowed()) return;
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (points.size !== 2 || active) return;
    event.preventDefault();
    active = true;
    gestures.add(element);
    // Release object/opening drags before the second finger can select anything.
    element.dispatchEvent(new Event(SCENE_NAVIGATION_START));
    saved = { damping: controls.enableDamping, autoRotate: controls.autoRotate };
    controls.enableDamping = false;
    controls.autoRotate = false;
    controls.update(); // Settle any remaining single-finger inertia once.
    controls.enabled = true;
    controls.dispatchEvent({ type: "start", target: controls });
  };
  const move = (event: PointerEvent) => {
    if (event.pointerType !== "touch" || !points.has(event.pointerId)) return;
    const before = points.size === 2 ? pair() : null;
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!active) return;
    // Own the whole gesture until both fingers lift, even if only one remains.
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!allowed() || !before || points.size !== 2) return;
    const after = pair();
    const scale = controls.enableZoom && before.distance > 1 && after.distance > 1
      ? Math.pow(before.distance / after.distance, controls.zoomSpeed) : 1;
    pinchCamera(controls.object as PerspectiveCamera, controls, element, before.midpoint,
      controls.enablePan ? after.midpoint : before.midpoint, scale, plan);
  };
  const up = (event: PointerEvent) => {
    points.delete(event.pointerId);
    if (!points.size) finish();
  };
  const cancel = () => {
    // Clear the native controls' pointer bookkeeping as well (e.g. on blur).
    for (const pointerId of [...points.keys()]) {
      element.dispatchEvent(Object.assign(new Event("pointercancel"), { pointerId, pointerType: "touch" }));
    }
    points.clear(); finish();
  };
  element.addEventListener("pointerdown", down, true);
  document.addEventListener("pointermove", move, { capture: true, passive: false });
  document.addEventListener("pointerup", up, true);
  document.addEventListener("pointercancel", up, true);
  document.defaultView?.addEventListener("blur", cancel);
  return () => {
    cancel();
    controls.zoomToCursor = previous.zoomToCursor;
    controls.touches.TWO = previous.two;
    element.removeEventListener("pointerdown", down, true);
    document.removeEventListener("pointermove", move, true);
    document.removeEventListener("pointerup", up, true);
    document.removeEventListener("pointercancel", up, true);
    document.defaultView?.removeEventListener("blur", cancel);
  };
}
