"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useThree } from "@react-three/fiber";
import { createCameraMotion } from "./cameraMotion";

const MotionPreviewContext = createContext<boolean | null>(null);
export function useCameraMotionPreview() { return useContext(MotionPreviewContext); }

type MotionControls = {
  autoRotate?: boolean;
  addEventListener(type: "start" | "change" | "end", listener: () => void): void;
  removeEventListener(type: "start" | "change" | "end", listener: () => void): void;
};

export function CameraMotionPreview({ children }: { children: ReactNode }) {
  const controls = useThree(state => state.controls) as MotionControls | undefined;
  const invalidate = useThree(state => state.invalidate);
  const [moving, setMoving] = useState(false);
  useEffect(() => {
    setMoving(false);
    if (!controls) return;
    const motion = createCameraMotion(value => { setMoving(value); invalidate(); });
    const change = () => motion.change(controls.autoRotate);
    const blur = () => motion.cancel();
    const hidden = () => { if (document.hidden) motion.cancel(); };
    controls.addEventListener("start", motion.start);
    controls.addEventListener("change", change);
    controls.addEventListener("end", motion.end);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      motion.dispose();
      controls.removeEventListener("start", motion.start);
      controls.removeEventListener("change", change);
      controls.removeEventListener("end", motion.end);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [controls, invalidate]);
  return <MotionPreviewContext.Provider value={moving}>{children}</MotionPreviewContext.Provider>;
}
