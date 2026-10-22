"use client";
import { useEffect, useRef } from "react";

export function PlannerViewport() {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const root = marker.current?.closest<HTMLElement>(
      ".planner-workspace,.kp-shell",
    );
    if (!root) return;
    const update = () => {
      const viewport = window.visualViewport;
      root.style.setProperty(
        "--planner-visible-height",
        `${viewport?.height ?? window.innerHeight}px`,
      );
      root.style.setProperty(
        "--planner-keyboard-offset",
        `${Math.max(0, window.innerHeight - (viewport?.height ?? window.innerHeight) - (viewport?.offsetTop ?? 0))}px`,
      );
    };
    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      root.style.removeProperty("--planner-visible-height");
      root.style.removeProperty("--planner-keyboard-offset");
    };
  }, []);
  return <span hidden ref={marker} />;
}
