"use client";

import { PlannerLink as Link } from "@/components/PlannerLink";
import { Armchair, Camera, CookingPot, PanelTop, Refrigerator, Ruler, Save, Search, Undo2, Redo2, X } from "lucide-react";
import type { ReactNode } from "react";
import type { KitchenSaveStatus } from "@/lib/kitchenSaveStatus";
import { KitchenProjectName } from "./KitchenProjectName";
import "./kitchen-project-header.css";

export type KitchenToolbarTool = "cabinets" | "appliances" | "dining" | "items" | "search" | "photo" | "annotation";
type Stage = "room" | "size" | "equipment" | "space" | "design" | "suggestions" | "finish";

const stages: [Stage, string][] = [
  ["room", "1. Гал тогоо"],
  ["size", "2. Хэмжээ"],
  ["equipment", "3. Төхөөрөмж"],
  ["space", "4. 2D өрөөний план"],
  ["design", "5. Өөрөө тохижуулах"],
  ["suggestions", "6. Таван санал"],
  ["finish", "7. Дуусгах"],
];
const tools = [
  { id: "cabinets", label: "Шүүгээ", icon: PanelTop },
  { id: "appliances", label: "Төхөөрөмж", icon: Refrigerator },
  { id: "dining", label: "Хоолны тавилга", icon: Armchair },
  { id: "items", label: "Гал тогооны эдлэл", icon: CookingPot },
  { id: "search", label: "Хайх", icon: Search },
  { id: "photo", label: "Зураг", icon: Camera },
  { id: "annotation", label: "Хэмжээс", icon: Ruler },
] as const;

export function KitchenPlannerHeader({ stage, onStage, activeTool, onTool, busy, canUndo, canRedo,
  onUndo, onRedo, onSave, loginHref, name, onName, subtotal, utilities, annotations, saveStatus }: {
  stage: Stage; onStage: (stage: Stage) => void;
  activeTool?: KitchenToolbarTool; onTool: (tool: KitchenToolbarTool) => void;
  busy: boolean; canUndo: boolean; canRedo: boolean;
  onUndo: () => void; onRedo: () => void; onSave?: () => void; loginHref: string;
  name: string; onName: (value: string) => void; subtotal: number; utilities: ReactNode; annotations: boolean;
  saveStatus?: KitchenSaveStatus;
}) {
  return <>
    <header className="kitchen-masthead">
      <nav className="kitchen-workflow-tabs" aria-label="Гал тогоогоо төлөвлөх алхмууд">
        {stages.map(([id, label]) => <button key={id} type="button" disabled={busy} data-planner-tour={id === "space" ? "kitchen-space" : undefined}
          aria-current={stage === id ? "step" : undefined} onClick={() => onStage(id)}>{label}</button>)}
      </nav>
      <select className="kitchen-mobile-stage" aria-label="Одоогийн алхам" value={stage} disabled={busy} onChange={event => onStage(event.target.value as Stage)}>
        {stages.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select>
      {stage === "design" && <button type="button" className="kitchen-mobile-continue" disabled={busy} onClick={() => onStage("suggestions")}>Үргэлжлүүлэх</button>}
      <div className="kitchen-project-tools">
        <KitchenProjectName name={name} onName={onName} busy={busy} status={saveStatus}/>
        {utilities}
        <span className="kitchen-tool-divider" />
        <button type="button" title="Буцаах · Ctrl+Z" aria-label="Буцаах" disabled={busy || !canUndo} onClick={onUndo}><Undo2 size={16} /></button>
        <button type="button" title="Дахин хийх · Ctrl+Shift+Z" aria-label="Дахин хийх" disabled={busy || !canRedo} onClick={onRedo}><Redo2 size={16} /></button>
        {onSave ? <button type="button" aria-label="Хадгалах" title="Хадгалах" disabled={busy} onClick={onSave}><Save size={16} /></button>
          : <Link href={loginHref} aria-label="Нэвтэрч хадгалах" title="Нэвтэрч хадгалах"><Save size={16} /></Link>}
        <Link href="/planner" title="Planner-оос гарах" aria-label="Planner-оос гарах"><X size={17} /></Link>
      </div>
    </header>
    {stage === "design" && <div className="kitchen-main-toolbar" role="toolbar" aria-label="Тавилгын үндсэн хэрэгслүүд">
      <div className="kitchen-category-tools">
        {tools.map(({ id, label, icon: Icon }) => <button key={id} type="button" disabled={busy} data-planner-tour={id === "cabinets" ? "kitchen-catalog" : undefined}
          className={id === "photo" ? "kitchen-toolbar-separated" : undefined}
          aria-label={label} aria-pressed={id === "annotation" ? annotations : activeTool === id}
          onClick={() => onTool(id)}><span className="kitchen-category-icon"><Icon size={20} strokeWidth={1.8} /></span><span>{label}</span></button>)}
      </div>
      <div className="kitchen-toolbar-checkout" data-planner-tour="kitchen-finish">
        <button type="button" className="kitchen-toolbar-total" onClick={() => onStage("finish")}><span>Миний гал тогоо</span><strong>{subtotal.toLocaleString("mn-MN")} ₮</strong></button>
        <button type="button" className="kitchen-toolbar-continue" disabled={busy} onClick={() => onStage("suggestions")}>Үргэлжлүүлэх</button>
      </div>
    </div>}
  </>;
}
