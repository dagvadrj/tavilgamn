"use client";

export type ModelPerformanceMetric = {
  asset: string;
  variant: "preview" | "high";
  readyMs: number;
  queueMs: number;
  loadDecodeMs: number;
  resourceDurationMs: number | null;
  encodedBodySize: number | null;
  totalReadyMs?: number;
  cacheHit?: boolean;
};

const reported = new Set<string>();
const recent: ModelPerformanceMetric[] = [];
export function getRecentModelMetrics() { return recent.slice(); }

export function reportModelPerformance(metric: ModelPerformanceMetric) {
  if (typeof window === "undefined") return;

  const detail = {
    ...metric,
    readyMs: Math.round(metric.readyMs),
    queueMs: Math.round(metric.queueMs),
    loadDecodeMs: Math.round(metric.loadDecodeMs),
    totalReadyMs: metric.totalReadyMs === undefined ? undefined : Math.round(metric.totalReadyMs),
    resourceDurationMs:
      metric.resourceDurationMs === null
        ? null
        : Math.round(metric.resourceDurationMs),
  };

  recent.push(detail);
  if (recent.length > 50) recent.shift();

  window.dispatchEvent(
    new CustomEvent<ModelPerformanceMetric>("tavilga:model-performance", {
      detail,
    }),
  );

  const key = `${detail.variant}:${detail.asset}`;
  if (reported.has(key)) return;
  reported.add(key);
  if (reported.size > 500) reported.delete(reported.values().next().value!);

  const configured = Number(
    process.env.NEXT_PUBLIC_MODEL_METRICS_SAMPLE_RATE ?? "0.1",
  );
  const sampleRate = Number.isFinite(configured)
    ? Math.min(1, Math.max(0, configured))
    : 0.1;
  if (sampleRate === 0 || Math.random() >= sampleRate) return;

  const payload = JSON.stringify(detail);
  if (navigator.sendBeacon && navigator.sendBeacon(
      "/api/model-metrics",
      new Blob([payload], { type: "application/json" }),
    )) {
    return;
  }

  void fetch("/api/model-metrics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => { /* Telemetry must not affect model loading. */ });
}
