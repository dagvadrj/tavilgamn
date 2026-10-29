"use client";

import { PlannerLink as Link } from "@/components/PlannerLink";
import {
  Armchair,
  ArrowRight,
  Camera,
  Check,
  CookingPot,
  CornerDownRight,
  Lightbulb,
  RectangleHorizontal,
  PanelTop,
  Refrigerator,
  Ruler,
  Save,
  Search,
  Undo2,
  Redo2,
  X,
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
  | "lighting"
  | "island"
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
  { id: "lighting", label: "Шугаман гэрэл", icon: Lightbulb },
  { id: "island", label: "Тек / Арал", icon: RectangleHorizontal },
  { id: "appliances", label: "Төхөөрөмж", icon: Refrigerator },
  { id: "dining", label: "Хоолны хэсэг", icon: Armchair },
  { id: "items", label: "Нэмэлт", icon: CookingPot },
  { id: "search", label: "Хайх", icon: Search },
  { id: "photo", label: "Тойм", icon: Camera },
  { id: "annotation", label: "Хэмжээс", icon: Ruler },
] as const;

export function KitchenPlannerHeader({
  stage,
  onStage,
  activeTool,
  onTool,
  busy,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  loginHref,
  name,
  onName,
  subtotal,
  utilities,
  annotations,
  saveStatus,
  itemCount = 1,
  unpricedCount = 0,
}: {
  stage: KitchenFlowStage;
  onStage: (stage: KitchenFlowStage) => void;
  activeTool?: KitchenToolbarTool;
  onTool: (tool: KitchenToolbarTool) => void;
  busy: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave?: () => void;
  loginHref: string;
  name: string;
  onName: (value: string) => void;
  subtotal: number;
  utilities: ReactNode;
  annotations: boolean;
  saveStatus?: KitchenSaveStatus;
  itemCount?: number;
  unpricedCount?: number;
}) {
  const current = kitchenWorkflowStep(stage);
  const index = KITCHEN_WORKFLOW_STEPS.findIndex((step) => step.id === current);
  const next = KITCHEN_WORKFLOW_STEPS[index + 1];
  const nextLabel =
    current === "space"
      ? "Тавилга нэмэх"
      : current === "design"
        ? "Үнэ харах"
        : "Хэмжилт хүсэх";
  const disabledNext = busy || (current !== "space" && !itemCount);
  return (
    <>
      <header className="kitchen-masthead">
        <nav
          className="kitchen-workflow-tabs"
          aria-label="Гал тогоогоо төлөвлөх алхмууд"
        >
          {KITCHEN_WORKFLOW_STEPS.map((step, stepIndex) => (
            <button
              key={step.id}
              type="button"
              disabled={busy || (step.id === "measurement" && !itemCount)}
              data-planner-tour={
                step.id === "space" ? "kitchen-space" : undefined
              }
              aria-current={current === step.id ? "step" : undefined}
              onClick={() => onStage(step.id)}
            >
              <span className="kitchen-step-number" aria-hidden="true">
                {stepIndex < index ? <Check size={13} /> : stepIndex + 1}
              </span>
              <span>{step.label}</span>
            </button>
          ))}
        </nav>
        <div className="kitchen-project-tools">
          <KitchenProjectName
            name={name}
            onName={onName}
            busy={busy}
            status={saveStatus}
          />
          {utilities}
          <span className="kitchen-tool-divider" />
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
              aria-label="Хадгалах"
              title="Хадгалах"
              disabled={busy}
              onClick={onSave}
            >
              <Save size={18} />
            </button>
          ) : (
            <Link
              href={loginHref}
              aria-label="Нэвтэрч хадгалах"
              title="Нэвтэрч хадгалах"
            >
              <Save size={18} />
            </Link>
          )}
          <Link
            href="/planner"
            title="Planner-оос гарах"
            aria-label="Planner-оос гарах"
          >
            <X size={18} />
          </Link>
        </div>
      </header>
      <div
        className="kitchen-main-toolbar"
        data-design-tools={stage === "design"}
      >
        {stage === "design" ? (
          <div
            className="kitchen-category-tools"
            role="toolbar"
            aria-label="Тавилгын үндсэн хэрэгслүүд"
          >
            {tools.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                disabled={busy}
                data-planner-tour={
                  id === "cabinets" ? "kitchen-catalog" : undefined
                }
                aria-label={label}
                aria-pressed={
                  id === "annotation" ? annotations : activeTool === id
                }
                onClick={() => onTool(id)}
              >
                <span className="kitchen-category-icon">
                  <Icon size={19} strokeWidth={1.8} />
                </span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="kitchen-step-context">
            <strong>{KITCHEN_WORKFLOW_STEPS[index].label}</strong>
            <span>{KITCHEN_WORKFLOW_STEPS[index].description}</span>
          </div>
        )}
        <div
          className="kitchen-toolbar-checkout"
          data-planner-tour="kitchen-finish"
        >
          {current === "design" && (
            <button
              type="button"
              className="kitchen-toolbar-total"
              disabled={busy}
              onClick={() => onStage("finish")}
            >
              <span>
                {unpricedCount ? "Үнэтэй мөрийн дэд дүн" : "Урьдчилсан дүн"}
              </span>
              <strong>
                {itemCount
                  ? unpricedCount > 0 && subtotal === 0
                    ? "Үнэ тодруулна"
                    : subtotal.toLocaleString("mn-MN") + " ₮"
                  : "Тавилгаа сонгоорой"}
              </strong>
            </button>
          )}
          {next && (
            <button
              type="button"
              className="kitchen-toolbar-continue"
              disabled={disabledNext}
              onClick={() => onStage(next.id)}
            >
              {nextLabel}
              <ArrowRight size={16} />
            </button>
          )}
          {current === "measurement" && (
            <button
              type="button"
              className="kitchen-toolbar-back"
              disabled={busy}
              onClick={() => onStage("finish")}
            >
              Үнийг дахин харах
            </button>
          )}
        </div>
      </div>
    </>
  );
}
