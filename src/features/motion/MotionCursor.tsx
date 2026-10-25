"use client";

import { MousePointer2 } from "lucide-react";
import {
  m as motion,
  LazyMotion,
  domAnimation,
  useReducedMotion,
} from "framer-motion";
import type { TourIllustration } from "@/features/planner/components/plannerTourSteps";
import "./motion-cursor.css";

export function MotionCursor({
  scene,
  paused = false,
}: {
  scene: TourIllustration;
  paused?: boolean;
}) {
  const reduced = useReducedMotion();
  const positions = {
    size: ["31%", "33%"],
    catalog: ["80%", "61%"],
    place: ["50%", "58%"],
    view: ["70%", "78%"],
    material: ["53%", "82%"],
    save: ["69%", "21%"],
  };
  return (
    <LazyMotion features={domAnimation}>
      <span
        className="motion-cursor-stage"
        data-cursor-scene={scene}
        data-paused={paused}
        aria-hidden="true"
      >
        <motion.span
          className="motion-cursor-mark"
          initial={false}
          animate={{ left: positions[scene][0], top: positions[scene][1] }}
          transition={{
            duration: reduced ? 0 : 0.62,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <MousePointer2 size={23} fill="white" />
          <i key={scene} />
        </motion.span>
      </span>
    </LazyMotion>
  );
}
