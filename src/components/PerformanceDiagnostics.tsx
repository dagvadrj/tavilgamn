"use client";

import { useEffect, useState } from "react";
import type { CanvasMetric } from "@/lib/performanceDiagnostics";
import { getRecentModelMetrics, type ModelPerformanceMetric } from "@/lib/modelPerformance";

export function PerformanceDiagnostics() {
  const [models, setModels] = useState<ModelPerformanceMetric[]>(getRecentModelMetrics);
  const [canvas, setCanvas] = useState<CanvasMetric[]>([]);
  useEffect(() => {
    const onModel = () => setModels(getRecentModelMetrics());
    const onCanvas = (event: Event) => {
      const detail = (event as CustomEvent<CanvasMetric>).detail;
      setCanvas(previous => [...previous.slice(-29), detail]);
    };
    window.addEventListener("tavilga:model-performance", onModel);
    window.addEventListener("tavilga:canvas-performance", onCanvas);
    return () => {
      window.removeEventListener("tavilga:model-performance", onModel);
      window.removeEventListener("tavilga:canvas-performance", onCanvas);
    };
  }, []);
  const latest = canvas.at(-1);
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ models, canvas }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url; link.download = "3d-performance.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <details open className="fixed bottom-3 left-3 z-[100] max-h-[45vh] w-[min(360px,calc(100vw-24px))] overflow-auto rounded-xl border bg-white/95 p-3 text-xs text-slate-900 shadow-lg">
    <summary className="cursor-pointer font-semibold">3D хурдны хэмжилт</summary>
    <p className="my-2">Зөвхөн энэ төхөөрөмжийн хэмжилт. GPU санах ой нь MB биш, нөөцийн тоо.</p>
    <output data-testid="canvas-performance">
      {latest ? <>
        <p>{latest.scene} · {latest.loop} · DPR {latest.dpr}</p>
        <p>Дүрслэлт/сек: {latest.renderFps} · Идэвхтэй FPS ≈ {latest.activeFps ?? "—"}</p>
        <p>Draw calls: {latest.drawCalls} · Triangle: {latest.triangles.toLocaleString()}</p>
        <p>Geometry: {latest.geometries} · Texture: {latest.textures} · JS: {latest.heapMiB ?? "—"} MB</p>
        <p>Камер хөдөлсөн кадр: {latest.cameraMotionFrames ?? 0} · Хөдөлгөөнд triangle: {latest.motionTriangles?.toLocaleString() ?? "—"}</p>
      </> : "Хэмжиж байна…"}
    </output>
    <ul className="my-2 space-y-1" data-testid="model-performance">
      {models.slice(-6).map((model, index) => <li key={`${model.asset}:${index}`}>
        {model.variant} · GLB харагдалт {model.readyMs} ms · GLB нийт {model.totalReadyMs ?? model.readyMs} ms
        {model.cacheHit ? " · decoded cache" : ""}
      </li>)}
    </ul>
    <button type="button" onClick={download} className="rounded border px-2 py-1">Хэмжилт хадгалах</button>
    <details><summary className="mt-2 cursor-pointer">Хэмжилтийн дэлгэрэнгүй</summary>
      <pre data-testid="performance-report" className="whitespace-pre-wrap">{JSON.stringify({ models, canvas }, null, 2)}</pre>
    </details>
  </details>;
}
