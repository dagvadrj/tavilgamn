"use client";

import { PlannerLink as Link } from "@/components/PlannerLink";
import {
  Armchair,
  ArrowRight,
  Camera,
  Check,
  CookingPot,
  CornerDownRight,
  Home,
  PanelTop,
  Refrigerator,
  Ruler,
  Save,
  Search,
  Undo2,
  Redo2,
} from "lucide-react";
import type { ReactNode } from "react";
import type { KitchenSaveStatus } from "@/lib/kitchenSaveStatus";
import {
  KITCHEN_WORKFLOW_STEPS,
  kitchenWorkflowStep,
  type KitchenFlowStage,
} from "@/lib/kitchenFlow";
import { KitchenProjectName } from "./KitchenProjectName";
import "./kitchen-project-header.css";

export type KitchenToolbarTool =
  | "corner"
  | "cabinets"
  | "appliances"
  | "dining"
  | "items"
  | "search"
  | "photo"
  | "annotation";
const tools = [
  { id: "cabinets", label: "Шүүгээ", icon: PanelTop },
  { id: "corner", label: "Булан", icon: CornerDownRight },
  { id: "appliances", label: "Төхөөрөмж", icon: Refrigerator },
  { id: "dining", label: "Хоолны хэсэг", icon: Armchair },
  { id: "items", label: "Нэмэлт", icon: CookingPot },
  { id: "search", label: "Хайх", icon: Search },
  { id: "photo", label: "Тойм", icon: Camera },
  { id: "annotation", label: "Хэмжээс", icon: Ruler },
] as const;

const NEXT_LABEL = {
  space: "Тохижуулах",
  design: "Урьдчилсан үнэ",
  finish: "Хэмжилт",
} as const;

/**
 * K shell header (64px): project and save state, the four-step stepper in the
 * middle, history, save and the primary «Дараах: …». A room with errors keeps
 * steps 2–4 closed; pressing one says why instead of silently doing nothing.
 */
export function KitchenPlannerHeader({
  stage,
  onStage,
  busy,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  loginHref,
  name,
  onName,
  utilities,
  saveStatus,
  title,
  lockReason = null,
  onLocked,
  itemCount = 1,
}: {
  stage: KitchenFlowStage;
  onStage: (stage: KitchenFlowStage) => void;
  busy: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave?: () => void;
  loginHref: string;
  name: string;
  onName: (value: string) => void;
  utilities: ReactNode;
  saveStatus?: KitchenSaveStatus;
  /** «Гал тогоо · 4.5 × 3.6 м». */
  title?: string;
  /** Room step errors; steps 2–4 stay closed while set. */
  lockReason?: string | null;
  onLocked?: (reason: string) => void;
  itemCount?: number;
  /** Former second-row props; the design tools now live in the panel. */
  onTool?: (tool: KitchenToolbarTool) => void;
  activeTool?: KitchenToolbarTool;
  annotations?: boolean;
  subtotal?: number;
  unpricedCount?: number;
}) {
  const current = kitchenWorkflowStep(stage);
  const index = KITCHEN_WORKFLOW_STEPS.findIndex((step) => step.id === current);
  const next = KITCHEN_WORKFLOW_STEPS[index + 1];
  const go = (target: KitchenFlowStage) => {
    if (target !== "space" && lockReason) {
      onLocked?.(lockReason);
      return;
    }
    onStage(target);
  };
  const nextBlocked = busy || (current !== "space" && !itemCount);
  return (
    <header className="kitchen-masthead kitchen-k-header">
      <Link href="/" className="kitchen-k-brand" aria-label="tavilga.mn нүүр">
        <span aria-hidden="true">
          <Home size={17} />
        </span>
        tavilga.mn
      </Link>
      <span className="kitchen-k-divider" aria-hidden="true" />
      <div className="kitchen-k-project">
        <span className="kitchen-k-eyebrow">
          Гал тогооны төлөвлөгч{title ? ` · ${title.replace(/^Гал тогоо · /, "")}` : ""}
        </span>
        <KitchenProjectName
          name={name}
          onName={onName}
          busy={busy}
          status={saveStatus}
        />
      </div>
      <nav
        className="kitchen-workflow-tabs kitchen-k-stepper"
        aria-label="Гал тогоогоо төлөвлөх алхмууд"
      >
        {KITCHEN_WORKFLOW_STEPS.map((step, stepIndex) => {
          const locked =
            (step.id !== "space" && !!lockReason) ||
            (step.id === "measurement" && !itemCount);
          return (
            <button
              key={step.id}
              type="button"
              disabled={busy || (step.id === "measurement" && !itemCount)}
              aria-disabled={locked || undefined}
              data-planner-tour={
                step.id === "space" ? "kitchen-space" : undefined
              }
              aria-current={current === step.id ? "step" : undefined}
              onClick={() => go(step.id)}
            >
              <span className="kitchen-step-number" aria-hidden="true">
                {stepIndex < index ? <Check size={13} /> : stepIndex + 1}
              </span>
              <span>{step.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="kitchen-project-tools kitchen-k-actions">
        {utilities}
        <button
          type="button"
          title="Буцаах · Ctrl+Z"
          aria-label="Буцаах"
          disabled={busy || !canUndo}
          onClick={onUndo}
        >
          <Undo2 size={18} />
        </button>
        <button
          type="button"
          title="Дахин хийх · Ctrl+Shift+Z"
          aria-label="Дахин хийх"
          disabled={busy || !canRedo}
          onClick={onRedo}
        >
          <Redo2 size={18} />
        </button>
        {onSave ? (
          <button
            type="button"
            className="kitchen-k-save"
            aria-label="Хадгалах"
            disabled={busy}
            onClick={onSave}
          >
            <Save size={17} />
            <span>Хадгалах</span>
          </button>
        ) : (
          <Link href={loginHref} className="kitchen-k-save" aria-label="Нэвтэрч хадгалах">
            <Save size={17} />
            <span>Нэвтэрч хадгалах</span>
          </Link>
        )}
        {next && current !== "measurement" && (
          <button
            type="button"
            className="kitchen-toolbar-continue"
            disabled={nextBlocked}
            aria-disabled={(next.id !== "space" && !!lockReason) || undefined}
            onClick={() => go(next.id)}
          >
            <span>
              Дараах
              <span className="kitchen-k-next-step">
                : {NEXT_LABEL[current as keyof typeof NEXT_LABEL]}
              </span>
            </span>
            <ArrowRight size={16} />
          </button>
        )}
      </div>
    </header>
  );
}

/** Design-step tool chips, shown in the left panel above the catalog. */
export function KitchenDesignTools({
  activeTool,
  annotations,
  busy,
  onTool,
}: {
  activeTool?: KitchenToolbarTool;
  annotations: boolean;
  busy: boolean;
  onTool: (tool: KitchenToolbarTool) => void;
}) {
  return (
    <div
      className="kitchen-category-tools kitchen-k-tools"
      role="toolbar"
      aria-label="Тавилгын үндсэн хэрэгслүүд"
    >
      {tools.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          disabled={busy}
          data-planner-tour={id === "cabinets" ? "kitchen-catalog" : undefined}
          aria-pressed={id === "annotation" ? annotations : activeTool === id}
          onClick={() => onTool(id)}
        >
          <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
