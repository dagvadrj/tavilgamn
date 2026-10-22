"use client";

import { memo, useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { plannerEnvironmentIntensity } from "@/lib/plannerLighting";

// Environment's portal captures again when `children` changes, even at frames=1.
// Keep the capture content stable across furniture edits AND daylight changes.
const reflectionStudio = (
  <>
    <color attach="background" args={["#858987"]} />
    <Lightformer
      form="rect"
      intensity={1.4}
      color="#ffffff"
      scale={[8, 6, 1]}
      position={[0, 5, -8]}
    />
    <Lightformer
      form="rect"
      intensity={0.65}
      color="#ffffff"
      scale={[6, 6, 1]}
      position={[-6, 3, 0]}
      rotation={[0, Math.PI / 2, 0]}
    />
    <Lightformer
      form="rect"
      intensity={2}
      color="#ffffff"
      scale={[5, 7, 1]}
      position={[0, 10, 0]}
      rotation={[Math.PI / 2, 0, 0]}
    />
  </>
);

interface PlannerEnvironmentProps {
  daylight?: number;
}

/** A single local 128px IBL capture, with no remote HDR or animation loop. */
export const PlannerEnvironment = memo(function PlannerEnvironment({
  daylight = 1,
}: PlannerEnvironmentProps) {
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  const intensity = plannerEnvironmentIntensity(daylight);
  useLayoutEffect(() => {
    const previousIntensity = scene.environmentIntensity;
    scene.environmentIntensity = intensity;
    invalidate();
    return () => {
      scene.environmentIntensity = previousIntensity;
    };
  }, [scene, intensity, invalidate]);

  return (
    <Environment resolution={128} frames={1} environmentIntensity={intensity}>
      {reflectionStudio}
    </Environment>
  );
});
