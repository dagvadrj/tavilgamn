"use client";
import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import type { OrbitControls } from "three-stdlib";
import { bindCursorNavigation } from "./sceneNavigation";

export function CursorNavigation({ enabled = true, plan = false }: { enabled?: boolean; plan?: boolean }) {
  const { controls, gl } = useThree();
  const allowed = useRef(enabled);
  allowed.current = enabled;
  useEffect(() => {
    if (!controls || !("target" in controls)) return;
    const orbit = controls as unknown as OrbitControls;
    return bindCursorNavigation(orbit, orbit.domElement ?? gl.domElement, () => allowed.current, plan);
  }, [controls, gl, plan]);
  return null;
}
