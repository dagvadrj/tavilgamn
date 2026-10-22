"use client";

import { motion } from "framer-motion";
import type { SVGProps } from "react";
import { useMotionActivity } from "@/features/motion/useMotionActivity";

/** Keep final values in the DOM; interpolate fresh data only while visible. */
export function ChartRect({
  x,
  y,
  width,
  height,
  ...props
}: SVGProps<SVGRectElement>) {
  const activity = useMotionActivity<SVGRectElement>();
  return (
    <motion.rect
      ref={activity.ref}
      className={props.className}
      rx={props.rx}
      initial={false}
      animate={{
        x: Number(x),
        y: Number(y),
        width: Number(width),
        height: Number(height),
      }}
      transition={{ duration: activity.active ? 0.4 : 0, ease: "easeOut" }}
    />
  );
}

export function ChartPath({ d, ...props }: SVGProps<SVGPathElement>) {
  const activity = useMotionActivity<SVGPathElement>();
  return (
    <motion.path
      ref={activity.ref}
      className={props.className}
      fill={props.fill}
      initial={false}
      animate={{ d }}
      transition={{ duration: activity.active ? 0.4 : 0, ease: "easeOut" }}
    />
  );
}
