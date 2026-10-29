"use client";
import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import { bindBlenderMouse, navigateCamera, type CameraBounds, type CameraRequest, type NavigationControls } from "@/lib/plannerCamera";
import { applyCameraPose, beginCameraTransition, cameraPose, cameraTransitionDestination, cancelCameraTransition } from "@/lib/cameraTransition";
import { PLANNER_CAMERA } from "@/lib/plannerCameraProfile";
import { CameraTransitionController } from "./CameraTransitionController";

export function CameraNavigation({ request, bounds, plan = false, leftDrag = false, handTool = false, enabled = true, onRest }: {
  request?: CameraRequest; bounds: CameraBounds; plan?: boolean; leftDrag?: boolean; handTool?: boolean; enabled?: boolean; onRest?: () => void;
}) {
  const { camera, controls, gl, size, invalidate } = useThree();
  const handled = useRef<number | undefined>(undefined);
  const pending = useRef(false);
  const zoomOwner = useRef(Symbol("button-zoom"));
  const { width, depth, height, centerX, centerY, centerZ } = bounds;
  useEffect(() => {
    if (!controls || !("mouseButtons" in controls)) return;
    const orbit = controls as Parameters<typeof bindBlenderMouse>[0];
    return bindBlenderMouse(orbit, orbit.domElement ?? gl.domElement, plan, leftDrag, handTool);
  }, [controls, gl, plan, leftDrag, handTool]);
  useEffect(() => {
    if (!enabled) {
      handled.current = request?.id;
      cancelCameraTransition(camera as PerspectiveCamera);
      return;
    }
    if (!request || handled.current === request.id || !controls || !("target" in controls)) return;
    // A focus click can reveal the hidden 3D canvas from the SVG plan. Wait
    // for its measured viewport instead of consuming the request at zero width.
    if (size.width < 1 || size.height < 1) return;
    // Apply after the view's camera rig/control swap has settled. Cancel stale work.
    pending.current = true;
    const frame = requestAnimationFrame(() => {
      pending.current = false;
      const perspective = camera as PerspectiveCamera;
      const orbit = controls as unknown as NavigationControls;
      const from = cameraPose(perspective, orbit.target);
      if (request.action === "zoom-in" || request.action === "zoom-out") {
        const destination = cameraTransitionDestination(perspective, zoomOwner.current);
        if (destination) applyCameraPose(perspective, destination, orbit);
      }
      navigateCamera(camera as PerspectiveCamera, controls as unknown as NavigationControls,
        request.action, { width, depth, height, centerX, centerY, centerZ }, size.width / Math.max(1, size.height), plan);
      beginCameraTransition(perspective, from, cameraPose(perspective, orbit.target), window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, orbit,
        { owner: request.action === "zoom-in" || request.action === "zoom-out" ? zoomOwner.current : undefined, duration: PLANNER_CAMERA.transitionSeconds });
      handled.current = request.id;
      invalidate();
    });
    // A gesture may arrive before the scheduled frame, not just during animation.
    const interrupt = () => { cancelAnimationFrame(frame); pending.current = false; handled.current = request.id; };
    const element = gl.domElement;
    element.addEventListener("pointerdown", interrupt, true);
    element.addEventListener("wheel", interrupt, true);
    element.addEventListener("keydown", interrupt, true);
    return () => {
      cancelAnimationFrame(frame);
      pending.current = false;
      element.removeEventListener("pointerdown", interrupt, true);
      element.removeEventListener("wheel", interrupt, true);
      element.removeEventListener("keydown", interrupt, true);
    };
  }, [request, camera, controls, gl, size.width, size.height, width, depth, height, centerX, centerY, centerZ, plan, enabled, invalidate]);
  return <CameraTransitionController onRest={() => {
    if (!pending.current && controls && (!request || handled.current === request.id)) onRest?.();
  }} />;
}
