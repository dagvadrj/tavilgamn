"use client";

import { useRef, useState } from "react";
import { Box, LoaderCircle, RotateCcw } from "lucide-react";
import { merchantRequest } from "@/features/merchant/merchantApi";
import {
  kitchenGlbIssues,
  kitchenGlbListingSuggestions,
  prepareKitchenDesignGlb,
} from "@/lib/kitchenDesignGlb";
import { kitchenGlbPlannerKitchen } from "@/lib/kitchenGlbModules";
import type { KitchenDesignSummary } from "@/lib/kitchenMarketplace";
import { renderKitchenGlbPreview } from "@/three/kitchenGlbPreview";
import { KitchenModelView } from "./KitchenDesignStage";
import "./kitchen-design-detail.css";
import "./kitchen-glb-source.css";

/**
 * The uploaded kitchen of one (possibly unpublished) version for its merchant or
 * an admin reviewer. With an owner and an editable version the GLB can be replaced.
 */
export function KitchenGlbVersionPanel({
  design,
  owner,
  editable = false,
  onReplaced,
}: {
  design: Pick<
    KitchenDesignSummary,
    "id" | "versionId" | "title" | "model" | "thumbnailUrl"
  >;
  owner?: string;
  editable?: boolean;
  onReplaced?: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!design.model) return null;
  const model = design.model;

  async function replace(file: File | undefined) {
    if (!file || !owner || busy) return;
    setError(null);
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-10000px;top:0;width:800px";
    document.body.appendChild(host);
    let dispose = () => {};
    try {
      setBusy("Загварыг боловсруулж байна…");
      const prepared = await prepareKitchenDesignGlb(file);
      const issues = kitchenGlbIssues(prepared.info);
      if (issues.length) throw new Error(issues.join(" "));
      const preview = await renderKitchenGlbPreview(host, prepared.file);
      dispose = preview.dispose;
      const thumbnail = await preview.capture();
      setBusy("Серверт хадгалж байна…");
      const form = new FormData();
      form.set("file", prepared.file);
      const saved = await merchantRequest<{ uploadId: string }>(
        "/api/merchant/kitchen-designs/models",
        owner,
        { method: "POST", body: form },
      );
      await merchantRequest(
        `/api/merchant/kitchen-designs/${design.id}/model`,
        owner,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            versionId: design.versionId,
            modelUploadId: saved.uploadId,
            ...replacementShape(prepared, file.name),
          }),
        },
      );
      const media = new FormData();
      media.set("file", thumbnail);
      media.set("versionId", design.versionId);
      media.set("kind", "thumbnail");
      media.set("isPrimary", "true");
      media.set("alt", design.title);
      await merchantRequest(
        `/api/merchant/kitchen-designs/${design.id}/media`,
        owner,
        {
          method: "POST",
          body: media,
        },
      );
      onReplaced?.();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "GLB загварыг сольж чадсангүй.",
      );
    } finally {
      dispose();
      host.remove();
      setBusy(null);
    }
  }

  return (
    <section className="kg-version">
      <div className="kg-version-head">
        <button
          type="button"
          className="btn-ghost"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <Box size={15} />
          {open ? "3D загварыг хаах" : "3D загвар харах"}
        </button>
        <span>
          GLB · {model.widthMm} × {model.depthMm} × {model.heightMm} мм ·{" "}
          {(model.bytes / 1048576).toFixed(1)} MB
        </span>
        {editable && owner && (
          <button
            type="button"
            className="btn-ghost"
            disabled={!!busy}
            onClick={() => input.current?.click()}
          >
            {busy ? (
              <LoaderCircle size={15} className="animate-spin" />
            ) : (
              <RotateCcw size={15} />
            )}
            {busy ?? "GLB солих"}
          </button>
        )}
      </div>
      {error && (
        <p className="kg-issue" role="alert">
          {error}
        </p>
      )}
      {open && (
        <KitchenModelView
          key={design.versionId}
          model={model}
          title={design.title}
          poster={design.thumbnailUrl}
          privateModel
        />
      )}
      <input
        ref={input}
        type="file"
        hidden
        accept=".glb,model/gltf-binary"
        aria-label="Шинэ GLB файл сонгох"
        onChange={(event) => {
          void replace(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </section>
  );
}

/** Detected modules rebuild the planner copy and module count of the new GLB. */
function replacementShape(
  prepared: Awaited<ReturnType<typeof prepareKitchenDesignGlb>>,
  fileName: string,
) {
  const { detection, parts, info } = prepared;
  const hints = kitchenGlbListingSuggestions(
    info,
    fileName,
    "modern",
    detection,
  );
  const planner = kitchenGlbPlannerKitchen(detection.modules, parts, {
    heightMm: info.heightMm,
    layout: hints.layout as "straight",
    backsplash: detection.backsplashM2 > 0,
    countertopColor: detection.countertopColor,
    countertopKind: detection.countertopKind,
    appliances: detection.appliances,
  });
  return planner
    ? { planner, layout: hints.layout, cabinetCount: hints.cabinetCount }
    : {};
}
