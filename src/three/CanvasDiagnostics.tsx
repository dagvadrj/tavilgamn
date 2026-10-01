"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { performanceDiagnosticsEnabled, reportCanvasMetric, summarizeFrames } from "@/lib/performanceDiagnostics";
import { useCameraMotionPreview } from "./CameraMotionPreview";

export function CanvasDiagnostics({ scene }: { scene: string }) {
  const gl = useThree(state => state.gl);
  const get = useThree(state => state.get);
  const moving = useCameraMotionPreview();
  const enabled = useRef(false);
  const sample = useRef({ frames: 0, intervals: [] as number[], last: 0,
    cameraMotionFrames: 0, motionTriangles: null as number | null, lastMoving: false });

  useFrame(() => {
    if (!enabled.current || document.hidden) return;
    const now = performance.now();
    const value = sample.current;
    if (value.last && value.intervals.length < 500) value.intervals.push(now - value.last);
    value.last = now;
    value.frames++;
    if (moving) {
      value.cameraMotionFrames++;
      // Renderer info describes the preceding draw, not this useFrame callback.
      if (value.lastMoving) value.motionTriangles = Math.min(value.motionTriangles ?? Infinity, gl.info.render.triangles);
    }
    value.lastMoving = Boolean(moving);
  });

  useEffect(() => {
    enabled.current = performanceDiagnosticsEnabled();
    if (!enabled.current) return;
    let started = performance.now();
    const reset = () => {
      started = performance.now();
      sample.current = { frames: 0, intervals: [], last: 0, cameraMotionFrames: 0, motionTriangles: null, lastMoving: false };
    };
    document.addEventListener("visibilitychange", reset);
    const timer = window.setInterval(() => {
      if (document.hidden) { reset(); return; }
      const now = performance.now();
      const { frames, intervals, cameraMotionFrames, motionTriangles } = sample.current;
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
        cameraMotionFrames, motionTriangles,
      });
      started = now;
      sample.current = { frames: 0, intervals: [], last: sample.current.last,
        cameraMotionFrames: 0, motionTriangles: null, lastMoving: sample.current.lastMoving };
    }, 2000);
    return () => {
      enabled.current = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", reset);
    };
  }, [gl, get, scene]);
  return null;
}
