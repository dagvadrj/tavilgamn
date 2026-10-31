"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Images, LoaderCircle, Smartphone } from "lucide-react";
import { KitchenDesignGallery } from "@/components/KitchenDesignGallery";
import { authFetch } from "@/lib/authFetch";
import type { KitchenDesignModel, KitchenGlbSlot } from "@/lib/kitchenMarketplace";
import {
  KITCHEN_FINISHES,
  KITCHEN_SLOT_LABELS,
  type KitchenFinishChoice,
  type KitchenFinishOption,
} from "@/lib/kitchenFinishes";
import { useKitchenFinishes } from "@/store/kitchenFinishes";
import type { KitchenDesignMedia } from "@/lib/kitchenDesignMedia";
import { loadProductModelViewer } from "@/lib/modelViewer";
import { renderKitchenGlbPreview } from "@/three/kitchenGlbPreview";

type Preview = Awaited<ReturnType<typeof renderKitchenGlbPreview>>;

type View = "photos" | "model";

const NO_CHOICE: KitchenFinishChoice = {};

/**
 * Photos and, for GLB-sourced designs, the uploaded kitchen itself in 3D/AR.
 * Unpublished versions (merchant/admin review) are fetched with the session token.
 */
export function KitchenDesignStage({
  media,
  title,
  model,
  poster,
  privateModel = false,
  initialView,
  designId,
}: {
  media: KitchenDesignMedia[];
  title: string;
  model: KitchenDesignModel | null;
  poster?: string | null;
  privateModel?: boolean;
  initialView?: View;
  /** With it the buyer may restyle the GLB, and the quote form hears of it. */
  designId?: string;
}) {
  const [view, setView] = useState<View>(
    initialView ?? (media.length || !model ? "photos" : "model"),
  );
  if (!model) return <KitchenDesignGallery media={media} title={title} />;
  return (
    <div className="kd-stage">
      <div className="kd-stage-switch" role="tablist" aria-label="Харагдац">
        <button
          type="button"
          role="tab"
          aria-selected={view === "photos"}
          onClick={() => setView("photos")}
        >
          <Images size={15} /> Зураг
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "model"}
          onClick={() => setView("model")}
        >
          <Box size={15} /> 3D загвар
        </button>
      </div>
      {view === "photos" ? (
        <KitchenDesignGallery media={media} title={title} />
      ) : (
        <KitchenModelView
          model={model}
          title={title}
          poster={poster}
          privateModel={privateModel}
          designId={designId}
        />
      )}
    </div>
  );
}

export function KitchenModelView({
  model,
  title,
  privateModel,
  designId,
}: {
  model: KitchenDesignModel;
  title: string;
  poster?: string | null;
  privateModel: boolean;
  designId?: string;
}) {
  const choose = useKitchenFinishes((state) => state.choose);
  const choice =
    useKitchenFinishes((state) => (designId ? state.choices[designId] : undefined)) ?? NO_CHOICE;
  const slots = model.slots;
  // Slots the merchant's GLB actually has parts for.
  const offered = useMemo(
    () =>
      slots
        ? (Object.keys(KITCHEN_SLOT_LABELS) as KitchenGlbSlot[]).filter((slot) => slots[slot].length)
        : [],
    [slots],
  );
  const looks = useMemo(() => {
    const result = new Map<number, KitchenFinishOption>();
    for (const slot of offered) {
      const option = KITCHEN_FINISHES[slot].find((item) => item.id === choice[slot]);
      if (option && slots) for (const id of slots[slot]) result.set(id, option);
    }
    return result;
  }, [offered, slots, choice]);
  const [finishSlot, setFinishSlot] = useState<KitchenGlbSlot | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const view = useRef<Preview | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edges, setEdges] = useState(true);
  const [arState, setArState] = useState<"idle" | "loading" | "desktop">(
    "idle",
  );
  useEffect(() => {
    if (!stage.current) return;
    const host = stage.current;
    let cancelled = false;
    let dispose = () => {};
    setReady(false);
    setError(null);
    void (async () => {
      const response = privateModel
        ? await authFetch(model.url)
        : await fetch(model.url);
      if (!response.ok) throw new Error("3D загварыг ачаалж чадсангүй.");
      const blob = await response.blob();
      if (cancelled) return;
      const preview = await renderKitchenGlbPreview(host, blob, {
        aspect: 0.75,
      });
      dispose = preview.dispose;
      if (cancelled) return dispose();
      view.current = preview;
      setReady(true);
    })().catch((reason) => {
      if (!cancelled)
        setError(
          reason instanceof Error
            ? reason.message
            : "3D загварыг ачаалж чадсангүй.",
        );
    });
    return () => {
      cancelled = true;
      view.current = null;
      dispose();
    };
  }, [model.url, privateModel]);
  useEffect(() => {
    view.current?.showEdges(edges);
  }, [edges, ready]);
  useEffect(() => {
    view.current?.setFinishes(looks);
  }, [looks, ready]);

  // The orbit view is our own (with board outlines); AR is handed to
  // model-viewer, which places the same public GLB via WebXR / Scene Viewer / Quick Look.
  async function openAr() {
    if (arState === "loading") return;
    setArState("loading");
    try {
      await loadProductModelViewer();
      const viewer = document.createElement("model-viewer") as HTMLElement & {
        activateAR?: () => Promise<void>;
        canActivateAR?: boolean;
      };
      viewer.setAttribute("src", new URL(model.url, window.location.href).href);
      viewer.setAttribute("alt", title);
      viewer.setAttribute("ar", "");
      viewer.setAttribute("ar-modes", "webxr scene-viewer quick-look");
      viewer.setAttribute("ar-placement", "floor");
      viewer.setAttribute("ar-scale", "fixed");
      viewer.style.cssText =
        "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none";
      document.body.appendChild(viewer);
      await new Promise((resolve) => {
        viewer.addEventListener("load", resolve, { once: true });
        window.setTimeout(resolve, 15000);
      });
      if (viewer.canActivateAR && viewer.activateAR) {
        await viewer.activateAR();
        setArState("idle");
      } else setArState("desktop");
      window.setTimeout(() => viewer.remove(), 60000);
    } catch {
      setArState("desktop");
    }
  }

  return (
    <section className="kd-model" aria-label="3D загвар">
      <div ref={stage} className="kd-model-stage" />
      {!ready && !error && (
        <p className="kd-model-status" role="status">
          <LoaderCircle size={18} className="animate-spin" /> 3D загварыг ачаалж
          байна…
        </p>
      )}
      {error && (
        <p className="kd-model-status" role="alert">
          {error}
        </p>
      )}
      {ready && (
        <button
          type="button"
          className="kd-model-edges"
          aria-pressed={edges}
          onClick={() => setEdges(!edges)}
        >
          {edges ? "Хүрээг нуух" : "Хүрээг харах"}
        </button>
      )}
      {ready && !privateModel && (
        <button
          type="button"
          className="kd-model-ar"
          onClick={() => void openAr()}
        >
          {arState === "loading" ? (
            <LoaderCircle size={15} className="animate-spin" />
          ) : (
            <Smartphone size={15} />
          )}
          {arState === "desktop"
            ? "AR-ыг утас, таблет дээр нээнэ үү"
            : "Өрөөндөө AR-аар харах"}
        </button>
      )}
      {ready && designId && offered.length > 0 && (
        <div className="kd-finishes" aria-label="Материал солих">
          <div className="kd-finish-slots" role="tablist">
            {offered.map((slot) => (
              <button
                key={slot}
                type="button"
                role="tab"
                aria-selected={finishSlot === slot}
                onClick={() => setFinishSlot(finishSlot === slot ? null : slot)}
              >
                {KITCHEN_SLOT_LABELS[slot].split(" (")[0]}
                {choice[slot] ? <i aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
          {finishSlot && (
            <div
              className="kd-finish-options"
              role="radiogroup"
              aria-label={KITCHEN_SLOT_LABELS[finishSlot]}
            >
              <button
                type="button"
                role="radio"
                aria-checked={!choice[finishSlot]}
                className="is-original"
                onClick={() => choose(designId, { ...choice, [finishSlot]: undefined })}
              >
                <span aria-hidden="true" />
                Анхны
              </button>
              {KITCHEN_FINISHES[finishSlot].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={choice[finishSlot] === option.id}
                  onClick={() => choose(designId, { ...choice, [finishSlot]: option.id })}
                >
                  <span aria-hidden="true" style={{ background: option.color }} />
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <span className="kd-gallery-label kd-model-size">
        {model.widthMm.toLocaleString("mn-MN")} ×{" "}
        {model.depthMm.toLocaleString("mn-MN")} ×{" "}
        {model.heightMm.toLocaleString("mn-MN")} мм
      </span>
    </section>
  );
}
