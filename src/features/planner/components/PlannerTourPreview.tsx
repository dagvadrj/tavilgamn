"use client";

import { Check, Layers, Ruler } from "lucide-react";
import type { PlannerTourKind, TourIllustration } from "./plannerTourSteps";
import { ModelDemo } from "@/features/motion/ModelDemo";
import "./planner-tour.css";

/** An isolated real GLB. Demonstrations never dispatch actions to the user's planner. */
export function TourPreview({
  kind,
  scene,
  paused = false,
  onReady,
}: {
  kind: PlannerTourKind;
  scene: TourIllustration;
  paused?: boolean;
  onReady?: (ready: boolean) => void;
}) {
  return (
    <div
      className="planner-tour-preview planner-tour-real-preview"
      data-scene={scene}
    >
      <div className="planner-tour-mini-bar">
        <Layers size={12} />
        <i />
        {kind === "kitchen" ? "KITCHEN PLANNER" : "ROOM PLANNER"}
      </div>
      <ModelDemo kind={kind} scene={scene} paused={paused} onReady={onReady} />
      <div className="planner-tour-real-caption" aria-hidden="true">
        {scene === "size" ? (
          <>
            <Ruler size={12} /> Бодит хэмжээгээ оруулах
          </>
        ) : scene === "catalog" ? (
          "Каталогоос сонгох"
        ) : scene === "place" ? (
          "Байрлалыг тохируулах"
        ) : scene === "material" ? (
          "Өнгө, материалыг харьцуулах"
        ) : scene === "view" ? (
          "Өнцөг бүрээс харах"
        ) : (
          <>
            <Check size={12} /> Шалгаад хадгалах
          </>
        )}
      </div>
    </div>
  );
}
