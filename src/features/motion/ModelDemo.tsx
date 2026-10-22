"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { ProductPhoto } from "@/features/home-motion/ProductPhoto";
import { useMotionActivity } from "./useMotionActivity";
import { MotionCursor } from "./MotionCursor";
import type { MarketingModel } from "@/lib/marketingModel";
import type {
  PlannerTourKind,
  TourIllustration,
} from "@/features/planner/components/plannerTourSteps";
import "./model-demo.css";

const ModelCanvas = dynamic(() => import("./ModelDemoCanvas"), { ssr: false });
const requests = new Map<PlannerTourKind, Promise<MarketingModel>>();
function readDemo(kind: PlannerTourKind) {
  let pending = requests.get(kind);
  if (!pending) {
    pending = fetch(`/api/marketing-model?kind=${kind}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.model?.id || !data.model?.file)
          throw new Error("Model unavailable");
        return data.model as MarketingModel;
      })
      .catch((error) => {
        requests.delete(kind);
        throw error;
      });
    requests.set(kind, pending);
  }
  return pending;
}

/** Poster first. Load one real asset only on screen; no room, HDR download or shadows. */
export function ModelDemo({
  model: supplied,
  kind = "room",
  scene,
  paused = false,
  poster,
  onReady,
  showCursor = true,
  resolveModel = true,
  loading = false,
  priority = false,
}: {
  model?: MarketingModel;
  kind?: PlannerTourKind;
  scene: TourIllustration;
  paused?: boolean;
  poster?: string;
  onReady?: (ready: boolean) => void;
  showCursor?: boolean;
  resolveModel?: boolean;
  loading?: boolean;
  priority?: boolean;
}) {
  const activity = useMotionActivity();
  const [resolved, setResolved] = useState<MarketingModel | undefined>(
    supplied,
  );
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [started, setStarted] = useState(false);
  const model = supplied ?? resolved;
  useEffect(() => {
    if (activity.visible) setStarted(true);
  }, [activity.visible]);
  useEffect(() => {
    if (supplied || !started || !resolveModel) return;
    let cancelled = false;
    setFailed(false);
    void readDemo(kind)
      .then((value) => {
        if (!cancelled) setResolved(value);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [supplied, started, kind, attempt, resolveModel]);
  useEffect(() => {
    setReady(false);
    setFailed(false);
  }, [model?.id, model?.file, attempt]);
  useEffect(() => {
    onReady?.(ready && !failed);
  }, [ready, failed, onReady]);
  return (
    <div
      ref={activity.ref}
      className="model-demo"
      data-model-ready={ready && !failed}
      data-demo-paused={paused || !activity.active}
    >
      <div className="model-demo-poster" aria-hidden={ready && !failed}>
        <ProductPhoto
          priority={priority}
          src={poster || model?.image}
          alt={model?.name ?? "Тавилгын 3D үзүүлбэр"}
        />
      </div>
      {started && model && !failed && (
        <ModelCanvas
          key={`${model.id}:${model.file}:${attempt}`}
          model={model}
          scene={scene}
          active={activity.active}
          visible={activity.visible}
          reduced={activity.reduced}
          onReady={() => setReady(true)}
          onError={() => setFailed(true)}
        />
      )}
      {!ready && !failed && (
        <span className="model-demo-status" role="status">
          {!model && !resolveModel && !loading
            ? "3D загвар хараахан алга."
            : "3D загварыг бэлдэж байна…"}
        </span>
      )}
      {failed && (
        <button
          type="button"
          className="model-demo-retry"
          onClick={() => {
            setFailed(false);
            setAttempt((value) => value + 1);
          }}
        >
          <RotateCcw size={14} /> 3D дахин ачаалах
        </button>
      )}
      {ready && (
        <>
          <span className="model-demo-badge">БОДИТ GLB · ҮЙЛДЛИЙН ЖИШЭЭ</span>
          {showCursor && (
            <MotionCursor scene={scene} paused={paused || !activity.active} />
          )}
        </>
      )}
    </div>
  );
}
