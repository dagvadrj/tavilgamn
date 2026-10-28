import { MathUtils, type PerspectiveCamera } from "three";
import type { OrbitControls } from "three-stdlib";
import { applyCameraPose, beginCameraTransition, cameraPose, cameraTransitionDestination, cancelCameraTransition, glideEase } from "@/lib/cameraTransition";
import { pinchCamera } from "./sceneNavigation";
import { PLANNER_CAMERA } from "@/lib/plannerCameraProfile";

/** Smooth wheel input shares the navigation controller's frame loop, with no idle RAF. */
export function bindSmoothOrbitZoom(controls: OrbitControls, element: HTMLElement, {
  invalidate, allowed, reducedMotion, plan = false,
}: {
  invalidate: () => void;
  allowed: () => boolean;
  reducedMotion: () => boolean;
  plan?: boolean;
}) {
  const camera = controls.object as PerspectiveCamera;
  const owner = Symbol("wheel-zoom");
  let lastTick = { at: -Infinity, direction: 0 };
  const wheel = (event: WheelEvent) => {
    if (!allowed() || !controls.enabled || !controls.enableZoom || !event.deltaY) return;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    event.preventDefault();
    // This capture listener owns wheel input before native OrbitControls and the
    // generic gesture-cancellation listener; otherwise each tick snaps the zoom.
    event.stopImmediatePropagation();
    const from = cameraPose(camera, controls.target);
    const base = cameraTransitionDestination(camera, owner) ?? from;
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
    // A fast scroll carries a little further than its ticks, like a flicked wheel.
    const now = event.timeStamp, direction = Math.sign(pixels);
    const momentum = now - lastTick.at < 100 && direction === lastTick.direction ? 1 + PLANNER_CAMERA.zoomMomentum : 1;
    lastTick = { at: now, direction };
    const scale = Math.exp(MathUtils.clamp(pixels, -600, 600) * .0015 * controls.zoomSpeed * momentum);
    const point = { x: event.clientX, y: event.clientY };
    controls.dispatchEvent({ type: "start", target: controls });
    try {
      applyCameraPose(camera, base, controls);
      pinchCamera(camera, controls, element, point, point, scale, plan);
      const to = cameraPose(camera, controls.target);
      beginCameraTransition(camera, from, to, reducedMotion(), controls, { owner, duration: PLANNER_CAMERA.zoomGlideSeconds, ease: glideEase });
    } finally {
      controls.dispatchEvent({ type: "end", target: controls });
      invalidate();
    }
  };
  element.addEventListener("wheel", wheel, { capture: true, passive: false });
  return () => {
    element.removeEventListener("wheel", wheel, true);
    if (cameraTransitionDestination(camera, owner)) cancelCameraTransition(camera);
  };
}
