"use client";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group } from "three";
import type { Material } from "@/lib/types";
import { createAppearanceController } from "./productSurfaceController";

export function ProductAppearance({ children, color, material, onRootReady }: {
  children: ReactNode; color: string; material: Material; onRootReady?: (root: Group | null) => void;
}) {
  const root = useRef<Group>(null);
  const reducedMotion = useRef(false);
  const firstFrame = useRef(true);
  const controller = useMemo(() => createAppearanceController(), []);
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { reducedMotion.current = query.matches; invalidate(); };
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [invalidate]);
  useEffect(() => { firstFrame.current = true; invalidate(); }, [color, material, invalidate]);
  useEffect(() => {
    onRootReady?.(root.current);
    return () => { onRootReady?.(null); controller.dispose(); };
  }, [controller, onRootReady]);
  useFrame((_, delta) => {
    if (!root.current) return;
    // Demand canvases can have a large idle delta; start the new transition now.
    const animating = controller.update(root.current, color, material, firstFrame.current ? 0 : delta, reducedMotion.current);
    firstFrame.current = false;
    root.current.userData.appearanceReady = !animating;
    if (animating) invalidate();
  });
  return <group ref={root}>{children}</group>;
}
