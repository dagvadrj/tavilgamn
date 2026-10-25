"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, type RefObject, type SVGProps } from "react";
import { useMotionActivity } from "@/features/motion/useMotionActivity";

const ease = [0.16, 1, 0.3, 1] as const;

/** Dashboard charts build once when they enter the viewport. */
function useChartEntrance<T extends SVGElement>(
  activity: { ref: RefObject<T | null>; active: boolean; reduced: boolean },
  kind: "bar" | "line" | "ring",
  signature: string,
  delay = 0,
) {
  const played = useRef(false);
  const { ref, active, reduced } = activity;
  useEffect(() => {
    const node = ref.current;
    if (!node || !node.closest(".dashboard-shell")) return;
    if (reduced) played.current = true;
    if (!active || played.current || typeof node.animate !== "function") return;
    played.current = true;
    let frames: Keyframe[];
    if (kind === "bar") {
      frames = [
        { transform: "scaleY(0)", transformOrigin: "0px 190px" },
        { transform: "scaleY(1)", transformOrigin: "0px 190px" },
      ];
    } else if (kind === "ring") {
      frames = [
        { strokeDasharray: "0 100" },
        { strokeDasharray: node.getAttribute("stroke-dasharray") ?? "0 100" },
      ];
    } else if (node.classList.contains("v14-chart-line")) {
      const length = (node as unknown as SVGPathElement).getTotalLength();
      frames = [
        { strokeDasharray: `${length} ${length}`, strokeDashoffset: length },
        { strokeDasharray: `${length} ${length}`, strokeDashoffset: 0 },
      ];
    } else {
      frames = [{ opacity: 0 }, { opacity: 1 }];
    }
    const animation = node.animate(frames, {
      duration: kind === "line" ? 1500 : 1150,
      delay: Math.min(delay, 300),
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      fill: "backwards",
    });
    return () => animation.cancel();
  }, [ref, active, reduced, kind, signature, delay]);
}

/** Keep final values in the DOM; interpolate fresh data only while visible. */
export function ChartRect({
  x,
  y,
  width,
  height,
  entranceDelay = 0,
  ...props
}: SVGProps<SVGRectElement> & { entranceDelay?: number }) {
  const activity = useMotionActivity<SVGRectElement>();
  useChartEntrance(
    activity,
    "bar",
    `${x},${y},${width},${height}`,
    entranceDelay,
  );
  return (
    <motion.rect
      ref={activity.ref}
      className={props.className}
      rx={props.rx}
      initial={false}
      animate={{
        attrX: Number(x),
        attrY: Number(y),
        width: Number(width),
        height: Number(height),
      }}
      transition={{ duration: activity.active ? 0.75 : 0, ease }}
    />
  );
}

export function ChartPath({ d, ...props }: SVGProps<SVGPathElement>) {
  const activity = useMotionActivity<SVGPathElement>();
  useChartEntrance(activity, "line", d ?? "");
  return (
    <motion.path
      ref={activity.ref}
      className={props.className}
      fill={props.fill}
      initial={false}
      animate={{ d }}
      transition={{ duration: activity.active ? 0.75 : 0, ease }}
    />
  );
}

export function ChartCircle(props: SVGProps<SVGCircleElement>) {
  const activity = useMotionActivity<SVGCircleElement>();
  useChartEntrance(
    activity,
    "ring",
    `${props.strokeDasharray},${props.strokeDashoffset}`,
  );
  return <circle {...props} ref={activity.ref} />;
}
