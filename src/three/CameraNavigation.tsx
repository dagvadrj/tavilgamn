"use client";
import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import { bindBlenderMouse, navigateCamera, type CameraBounds, type CameraRequest, type NavigationControls } from "@/lib/plannerCamera";
import { beginCameraTransition, cameraPose } from "@/lib/cameraTransition";
import { CameraTransitionController } from "./CameraTransitionController";

export function CameraNavigation({ request, bounds, plan = false, leftDrag = false }: {
  request?: CameraRequest; bounds: CameraBounds; plan?: boolean; leftDrag?: boolean;
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
    if (!request || handled.current === request.id || !controls || !("target" in controls)) return;
    // Apply after the view's camera rig/control swap has settled. Cancel stale work.
    const frame = requestAnimationFrame(() => {
      const perspective = camera as PerspectiveCamera;
      const orbit = controls as unknown as NavigationControls;
      const from = cameraPose(perspective, orbit.target);
      navigateCamera(camera as PerspectiveCamera, controls as unknown as NavigationControls,
        request.action, { width, depth, height, centerX, centerY, centerZ }, size.width / Math.max(1, size.height), plan);
      if (beginCameraTransition(perspective, from, cameraPose(perspective, orbit.target), window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)) {
        orbit.target.copy(from.target); orbit.update();
      }
      handled.current = request.id;
      invalidate();
    });
    return () => cancelAnimationFrame(frame);
  }, [request, camera, controls, size.width, size.height, width, depth, height, centerX, centerY, centerZ, plan, invalidate]);
  return <CameraTransitionController />;
}
