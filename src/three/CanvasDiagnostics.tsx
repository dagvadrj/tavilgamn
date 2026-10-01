"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { performanceDiagnosticsEnabled, reportCanvasMetric, summarizeFrames } from "@/lib/performanceDiagnostics";

export function CanvasDiagnostics({ scene }: { scene: string }) {
  const gl = useThree(state => state.gl);
  const get = useThree(state => state.get);
  const enabled = useRef(false);
  const sample = useRef({ frames: 0, intervals: [] as number[], last: 0 });

  useFrame(() => {
    if (!enabled.current || document.hidden) return;
    const now = performance.now();
    const value = sample.current;
    if (value.last && value.intervals.length < 500) value.intervals.push(now - value.last);
    value.last = now;
    value.frames++;
  });

  useEffect(() => {
    enabled.current = performanceDiagnosticsEnabled();
    if (!enabled.current) return;
    let started = performance.now();
    const reset = () => {
      started = performance.now();
      sample.current = { frames: 0, intervals: [], last: 0 };
    };
    document.addEventListener("visibilitychange", reset);
    const timer = window.setInterval(() => {
      if (document.hidden) { reset(); return; }
      const now = performance.now();
      const { frames, intervals } = sample.current;
      const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      reportCanvasMetric({
        scene, frames, durationMs: Math.round(now - started),
        ...summarizeFrames(intervals, frames, now - started),
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        dpr: gl.getPixelRatio(),
        heapMiB: memory ? Math.round(memory.usedJSHeapSize / 1048576) : null,
        loop: get().frameloop,
      });
      started = now;
      sample.current = { frames: 0, intervals: [], last: sample.current.last };
    }, 2000);
    return () => {
      enabled.current = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", reset);
    };
  }, [gl, get, scene]);
  return null;
}
