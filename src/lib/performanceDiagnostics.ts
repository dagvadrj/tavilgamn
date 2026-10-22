"use client";

export type CanvasMetric = {
  scene: string;
  frames: number;
  durationMs: number;
  renderFps: number;
  activeFps: number | null;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  dpr: number;
  heapMiB: number | null;
  loop: string;
  cameraMotionFrames?: number;
  motionTriangles?: number | null;
  motionP95Ms?: number | null;
  motionWorstMs?: number | null;
  motionSlowFrames?: number;
  shadowAutoUpdate?: boolean;
  cameraPosition?: [number, number, number];
  cameraTarget?: [number, number, number];
  cameraFov?: number;
};

export function performanceDiagnosticsEnabled() {
  return typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("performance") === "1";
}

// Local, opt-in diagnostic data only. No scene contents or personal data sent.
export function reportCanvasMetric(detail: CanvasMetric) {
  window.dispatchEvent(new CustomEvent("tavilga:canvas-performance", { detail }));
  // Enabled only by ?performance=1 in CanvasDiagnostics; stays local.
  console.debug("[canvas-performance]", JSON.stringify(detail));
}

export function summarizeMotionFrames(intervals: number[]) {
  // Consecutive interaction frames are known to be active: retain long stalls.
  const values = intervals.filter(value => Number.isFinite(value) && value > 0).sort((a,b) => a-b);
  return {
    motionP95Ms: values.length ? Math.round(values[Math.ceil(values.length*0.95)-1]*10)/10 : null,
    motionWorstMs: values.length ? Math.round(values[values.length-1]*10)/10 : null,
    motionSlowFrames: values.filter(value => value > 1000/30).length,
  };
}

export function summarizeFrames(intervals: number[], frames: number, durationMs: number) {
  // Approximate active cadence only: long gaps may be idle or stalls.
  // renderFps still counts every frame over the full sampling window.
  const active = intervals.filter(value => Number.isFinite(value) && value > 0 && value < 250);
  return {
    renderFps: Math.round(frames * 1000 / Math.max(1, durationMs)),
    activeFps: active.length
      ? Math.round(active.length * 1000 / active.reduce((sum, value) => sum + value, 0))
      : null,
  };
}
