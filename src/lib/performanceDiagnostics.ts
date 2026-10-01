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
};

export function performanceDiagnosticsEnabled() {
  return typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("performance") === "1";
}

// Local, opt-in diagnostic data only. No scene contents or personal data sent.
export function reportCanvasMetric(detail: CanvasMetric) {
  window.dispatchEvent(new CustomEvent("tavilga:canvas-performance", { detail }));
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
