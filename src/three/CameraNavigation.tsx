"use client";
import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import { bindBlenderMouse, navigateCamera, type CameraBounds, type CameraRequest, type NavigationControls } from "@/lib/plannerCamera";

export function CameraNavigation({ request, bounds, plan = false }: {
  request?: CameraRequest; bounds: CameraBounds; plan?: boolean;
}) {
  const { camera, controls, gl, size, invalidate } = useThree();
  const handled = useRef<number | undefined>(request?.id);
  const { width, depth, height, centerX, centerZ } = bounds;
  useEffect(() => {
    if (!controls || !("mouseButtons" in controls)) return;
    const orbit = controls as Parameters<typeof bindBlenderMouse>[0];
    return bindBlenderMouse(orbit, orbit.domElement ?? gl.domElement, plan);
  }, [controls, gl, plan]);
  useEffect(() => {
    if (!request || handled.current === request.id || !controls || !("target" in controls)) return;
    // Apply after the view's camera rig/control swap has settled. Cancel stale work.
    const frame = requestAnimationFrame(() => {
      navigateCamera(camera as PerspectiveCamera, controls as unknown as NavigationControls,
        request.action, { width, depth, height, centerX, centerZ }, size.width / Math.max(1, size.height), plan);
      handled.current = request.id;
      invalidate();
    });
    return () => cancelAnimationFrame(frame);
  }, [request, camera, controls, size.width, size.height, width, depth, height, centerX, centerZ, plan, invalidate]);
  return null;
}
