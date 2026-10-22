"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";

/** A shared boundary for finite animation; background tabs never keep ticking. */
export function useMotionActivity<T extends Element = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const inView = useInView(ref, { amount: 0.15 });
  const reduced = useReducedMotion();
  const [foreground, setForeground] = useState(true);
  useEffect(() => {
    const update = () => setForeground(document.visibilityState !== "hidden");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return {
    ref,
    visible: inView && foreground,
    active: inView && foreground && reduced === false,
    reduced: reduced === true,
    inView,
  };
}

export function useDemoPlayback(count: number, duration = 2200, ready = true) {
  const activity = useMotionActivity();
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (!activity.active || !playing || !ready) return;
    const timer = window.setTimeout(() => {
      if (step === count - 1) setPlaying(false);
      else setStep(step + 1);
    }, duration);
    return () => window.clearTimeout(timer);
  }, [activity.active, playing, step, count, duration, run, ready]);
  return {
    ...activity,
    step,
    playing,
    run,
    choose: (next: number) => {
      setStep(Math.max(0, Math.min(count - 1, next)));
      setPlaying(false);
    },
    toggle: () => {
      if (step === count - 1 && !playing) {
        setStep(0);
        setRun((value) => value + 1);
      }
      setPlaying((value) => !value);
    },
    replay: () => {
      setStep(0);
      setRun((value) => value + 1);
      setPlaying(true);
    },
  };
}
