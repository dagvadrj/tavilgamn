"use client";

import { useEffect, useRef } from "react";
import { animate } from "framer-motion";
import { useMotionActivity } from "@/features/motion/useMotionActivity";

export function AnimatedNumber({
  value,
  money = false,
}: {
  value: string | number;
  money?: boolean;
}) {
  const activity = useMotionActivity<HTMLSpanElement>();
  const ref = useRef<HTMLSpanElement>(null),
    previous = useRef(0);
  const entered = useRef(false);
  const label = Number.isSafeInteger(Number(value))
    ? Number(value).toLocaleString("mn-MN")
    : BigInt(value).toLocaleString("mn-MN");
  useEffect(() => {
    const node = ref.current,
      target = Number(value);
    if (!node) return;
    if (!Number.isSafeInteger(target) || activity.reduced) {
      node.textContent = label;
      previous.current = target;
      entered.current = true;
      return;
    }
    if (!activity.active) {
      node.textContent = label;
      // Before the first view, retain zero for the entrance count-up. Later
      // offscreen/background updates settle immediately and never replay.
      if (entered.current) previous.current = target;
      return;
    }
    entered.current = true;
    const from = Number.isFinite(previous.current) ? previous.current : target,
      controls = animate(from, target, {
        duration: 1.1,
        ease: [0.16, 1, 0.3, 1],
        onUpdate: (next) => {
          previous.current = next;
          node.textContent = Math.round(next).toLocaleString("mn-MN");
        },
        onComplete: () => {
          previous.current = target;
        },
      });
    return () => controls.stop();
  }, [value, label, activity.active, activity.reduced]);
  return (
    <span
      className="dashboard-animated-number"
      ref={activity.ref}
      aria-label={label + (money ? " ₮" : "")}
    >
      <span ref={ref} aria-hidden="true">
        {label}
      </span>
      {money && <span aria-hidden="true"> ₮</span>}
    </span>
  );
}
