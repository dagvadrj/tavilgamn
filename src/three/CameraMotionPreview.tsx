"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Quaternion, Vector3, type Camera } from "three";
import { createCameraMotion } from "./cameraMotion";

const MotionPreviewContext = createContext<boolean | null>(null);
export function useCameraMotionPreview() { return useContext(MotionPreviewContext); }

type MotionControls = {
  autoRotate?: boolean;
  addEventListener(type: "start" | "change" | "end", listener: () => void): void;
  removeEventListener(type: "start" | "change" | "end", listener: () => void): void;
};

export function CameraMotionPreview({ children, interactionActive = false }: {
  children: ReactNode;
  /** Reduce render resolution during furniture placement as well as camera motion. */
  interactionActive?: boolean;
}) {
  const controls = useThree(state => state.controls) as MotionControls | undefined;
  const invalidate = useThree(state => state.invalidate);
  const [moving, setMoving] = useState(false);
  const detector = useRef<ReturnType<typeof createCameraMotion> | null>(null);
  const previous = useRef({ camera: null as Camera | null, position: new Vector3(), rotation: new Quaternion(), zoom: 1, fov: 0 });
  useFrame(({ camera }) => {
    const pose = previous.current;
    const projection = camera as Camera & { zoom?: number; fov?: number };
    const zoom = projection.zoom ?? 1, fov = projection.fov ?? 0;
    if (pose.camera === camera) {
      // Match OrbitControls' visual-change threshold. Its sub-millimetre damping
      // tail must not restart preview on the final full-resolution redraw.
      const changed = pose.position.distanceToSquared(camera.position) > 1e-6 ||
        8 * (1 - Math.abs(pose.rotation.dot(camera.quaternion))) > 1e-6 ||
        Math.abs(pose.zoom - zoom) > 1e-4 || Math.abs(pose.fov - fov) > 1e-4;
      if (!changed) return; // Accumulate slow motion against the last sampled pose.
      detector.current?.observe(controls?.autoRotate);
    }
    pose.camera = camera;
    pose.position.copy(camera.position);
    pose.rotation.copy(camera.quaternion);
    pose.zoom = zoom;
    pose.fov = fov;
  });
  useEffect(() => {
    setMoving(false);
    previous.current.camera = null;
    const motion = createCameraMotion(value => { setMoving(value); invalidate(); });
    detector.current = motion;
    const change = () => motion.change(controls?.autoRotate);
    const blur = () => motion.cancel();
    const hidden = () => { if (document.hidden) motion.cancel(); };
    controls?.addEventListener("start", motion.start);
    controls?.addEventListener("change", change);
    controls?.addEventListener("end", motion.end);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      motion.dispose();
      detector.current = null;
      controls?.removeEventListener("start", motion.start);
      controls?.removeEventListener("change", change);
      controls?.removeEventListener("end", motion.end);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [controls, invalidate]);
  return <MotionPreviewContext.Provider value={moving || interactionActive}>{children}</MotionPreviewContext.Provider>;
}
