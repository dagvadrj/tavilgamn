"use client";
import { useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { Group } from "three";
import { KitchenARViewer } from "./KitchenARViewer";

export function KitchenExportButtons({
  root,
  name,
  disabled,
}: {
  root: Group | null;
  name: string;
  disabled: boolean;
}) {
  const [working, setWorking] = useState<"glb" | "skp" | "ar" | null>(null);
  const [message, setMessage] = useState("");
  const lock = useRef(false),
    request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function exportFile(format: "glb" | "skp") {
    if (!root || disabled || lock.current) return;
    lock.current = true;
    setWorking(format);
    setMessage("");
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 120000);
    try {
      const { encodeKitchenGlb, downloadKitchenFile, kitchenExportFilename } =
        await import("@/three/kitchenExport");
      if (format === "skp") {
        const response = await fetch("/api/kitchen/export/skp", {
          signal: controller.signal,
        });
        const status = await response.json();
        if (!response.ok || !status.available)
          throw new Error(
            "SKP хөрвүүлэгч сервер хараахан холбогдоогүй байна. GLB-г SketchUp 2026-д File → Import хийж, Save As → .skp гэж хадгалж болно.",
          );
      }
      const data = await encodeKitchenGlb(root);
      if (controller.signal.aborted) throw new Error("Экспорт цуцлагдлаа.");
      let blob = new Blob([data], { type: "model/gltf-binary" });
      if (format === "skp") {
        const response = await fetch("/api/kitchen/export/skp", {
          method: "POST",
          headers: { "Content-Type": "model/gltf-binary" },
          body: blob,
          signal: controller.signal,
        });
        if (!response.ok) {
          const problem = await response.json().catch(() => null);
          throw new Error(problem?.error || "SKP хөрвүүлэлт амжилтгүй боллоо.");
        }
        blob = await response.blob();
      }
      if (controller.signal.aborted) return;
      downloadKitchenFile(blob, kitchenExportFilename(name, format));
      setMessage(
        `${format.toUpperCase()} файл бэлэн. Шалгүй, тавилгын бүх 3D хэсгийг орууллаа.`,
      );
    } catch (error) {
      if (!controller.signal.aborted)
        setMessage(
          error instanceof Error ? error.message : "Экспорт амжилтгүй боллоо.",
        );
      else setMessage("Экспорт хугацаандаа дууссангүй. Дахин оролдоно уу.");
    } finally {
      clearTimeout(timeout);
      lock.current = false;
      setWorking(null);
      request.current = null;
    }
  }
  return (
    <div className="km-export" aria-label="Гарнитурын 3D файл экспортлох">
      <div className="km-export-actions">
        {(["glb", "skp"] as const).map((format) => (
          <button
            key={format}
            type="button"
            className="btn-ghost"
            disabled={disabled || !root || !!working}
            onClick={() => void exportFile(format)}
          >
            {working === format ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            {working === format
              ? `${format.toUpperCase()} бэлдэж байна…`
              : `${format.toUpperCase()} татах`}
          </button>
        ))}

        <small>Бүх тавилга, материалтай · Шалгүй</small>
        <KitchenARViewer
          root={root}
          name={name}
          disabled={disabled || !!working}
          onWorkingChange={(active) => {
            lock.current = active;

            setWorking(active ? "ar" : null);
          }}
        />
      </div>
      {message && (
        <p role="status" aria-live="polite">
          {message}
        </p>
      )}
    </div>
  );
}
