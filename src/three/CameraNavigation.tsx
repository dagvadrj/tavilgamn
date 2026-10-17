"use client";
import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import { bindBlenderMouse, navigateCamera, type CameraBounds, type CameraRequest, type NavigationControls } from "@/lib/plannerCamera";
import { beginCameraTransition, cameraPose, cancelCameraTransition } from "@/lib/cameraTransition";
import { CameraTransitionController } from "./CameraTransitionController";

export function CameraNavigation({ request, bounds, plan = false, leftDrag = false, enabled = true }: {
  request?: CameraRequest; bounds: CameraBounds; plan?: boolean; leftDrag?: boolean; enabled?: boolean;
}) {
  const { camera, controls, gl, size, invalidate } = useThree();
  const handled = useRef<number | undefined>(undefined);
  const { width, depth, height, centerX, centerY, centerZ } = bounds;
  useEffect(() => {
    if (!controls || !("mouseButtons" in controls)) return;
    const orbit = controls as Parameters<typeof bindBlenderMouse>[0];
    return bindBlenderMouse(orbit, orbit.domElement ?? gl.domElement, plan, leftDrag);
  }, [controls, gl, plan, leftDrag]);
  useEffect(() => {
    if (!enabled) {
      handled.current = request?.id;
      cancelCameraTransition(camera as PerspectiveCamera);
      return;
    }
    if (!request || handled.current === request.id || !controls || !("target" in controls)) return;
    // Apply after the view's camera rig/control swap has settled. Cancel stale work.
    const frame = requestAnimationFrame(() => {
      const perspective = camera as PerspectiveCamera;
      const orbit = controls as unknown as NavigationControls;
      const from = cameraPose(perspective, orbit.target);
      navigateCamera(camera as PerspectiveCamera, controls as unknown as NavigationControls,
        request.action, { width, depth, height, centerX, centerY, centerZ }, size.width / Math.max(1, size.height), plan);
      beginCameraTransition(perspective, from, cameraPose(perspective, orbit.target), window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, orbit);
      handled.current = request.id;
      invalidate();
    });
    // A gesture may arrive before the scheduled frame, not just during animation.
    const interrupt = () => { cancelAnimationFrame(frame); handled.current = request.id; };
    const element = gl.domElement;
    element.addEventListener("pointerdown", interrupt, true);
    element.addEventListener("wheel", interrupt, true);
    element.addEventListener("keydown", interrupt, true);
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("pointerdown", interrupt, true);
      element.removeEventListener("wheel", interrupt, true);
      element.removeEventListener("keydown", interrupt, true);
    };
  }, [request, camera, controls, gl, size.width, size.height, width, depth, height, centerX, centerY, centerZ, plan, enabled, invalidate]);
  return <CameraTransitionController />;
}
