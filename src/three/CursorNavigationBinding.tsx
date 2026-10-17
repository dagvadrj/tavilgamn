"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import type { OrbitControls } from "three-stdlib";
import { bindCursorNavigation } from "./sceneNavigation";
import { bindSmoothOrbitZoom } from "./smoothOrbitZoom";

export function CursorNavigation({ enabled = true, plan = false, smoothZoom = false }: { enabled?: boolean; plan?: boolean; smoothZoom?: boolean }) {
  const { controls, gl, invalidate } = useThree();
  const allowed = useRef(enabled);
  allowed.current = enabled;
  // Install before passive cancellation/native wheel handlers are attached.
  useLayoutEffect(() => {
    if (!smoothZoom || !controls || !("target" in controls)) return;
    const orbit = controls as unknown as OrbitControls;
    return bindSmoothOrbitZoom(orbit, orbit.domElement ?? gl.domElement, {
      allowed: () => allowed.current, invalidate, plan,
      reducedMotion: () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    });
  }, [controls, gl, invalidate, plan, smoothZoom]);
  useEffect(() => {
    if (!controls || !("target" in controls)) return;
    const orbit = controls as unknown as OrbitControls;
    return bindCursorNavigation(orbit, orbit.domElement ?? gl.domElement, () => allowed.current, plan);
  }, [controls, gl, plan]);
  return null;
}
