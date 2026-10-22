"use client";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AnimationMixer,
  LoopOnce,
  type AnimationClip,
  type Object3D,
} from "three";
import {
  setKitchenGlbOpen,
  type KitchenPartMotion,
} from "./kitchenGlbComposition";

/** One reversible timeline for authored clips and separately assembled doors. */
export function useKitchenOpenAnimation(
  root: Object3D | undefined,
  clip: AnimationClip | undefined,
  open: boolean,
  motions?: KitchenPartMotion[],
) {
  const invalidate = useThree((state) => state.invalidate);
  const progress = useRef(0);
  const timeline = useRef<{ mixer: AnimationMixer; duration: number } | null>(
    null,
  );
  const applied = useRef<{
    root?: Object3D;
    clip?: AnimationClip;
    motions?: KitchenPartMotion[];
    progress: number;
  }>({ progress: -1 });
  useEffect(() => {
    if (!root || !clip) return;
    const mixer = new AnimationMixer(root);
    const action = mixer.clipAction(clip);
    action.setLoop(LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    timeline.current = { mixer, duration: clip.duration };
    invalidate();
    return () => {
      timeline.current = null;
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
    };
  }, [root, clip, invalidate]);
  useEffect(() => {
    invalidate();
  }, [open, motions, invalidate]);
  useFrame((_, delta) => {
    if (!root || (!clip && !motions?.length)) return;
    const target = Number(open);
    const last = applied.current;
    // An idle door must not resample its entire animation hierarchy every time
    // the camera requests a frame. Apply once again when an async model changes.
    if (progress.current === target && last.progress === target &&
      last.root === root && last.clip === clip && last.motions === motions) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    progress.current = reduce
      ? target
      : advanceKitchenOpenProgress(progress.current, target, delta);
    const eased =
      progress.current * progress.current * (3 - 2 * progress.current);
    if (motions) setKitchenGlbOpen(motions, eased);
    const current = timeline.current;
    if (current) {
      // A clamped LoopOnce disables itself at the end; re-enable before reversing.
      const action = current.mixer.clipAction(clip!);
      action.enabled = true;
      action.paused = false;
      current.mixer.setTime(eased * current.duration);
    }
    last.root = root;
    last.clip = clip;
    last.motions = motions;
    last.progress = progress.current;
    if (progress.current !== target) invalidate();
  });
}

export function advanceKitchenOpenProgress(
  progress: number,
  target: number,
  delta: number,
) {
  const step = Math.max(0, Math.min(delta, 0.05)) / 0.45;
  return target > progress
    ? Math.min(target, progress + step)
    : Math.max(target, progress - step);
}
