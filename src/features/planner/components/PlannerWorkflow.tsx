"use client";

import Link from "next/link";
import { House, LayoutGrid, Paintbrush } from "lucide-react";

export function PlannerSwitcher({ current }: { current: "room" | "kitchen" }) {
  return <nav className="studio-switch" aria-label="Төлөвлөгч сонгох">
    <Link href="/planner" aria-current={current === "room" ? "page" : undefined}>Өрөө</Link>
    <Link href="/kitchen" aria-current={current === "kitchen" ? "page" : undefined}>Гал тогоо</Link>
  </nav>;
}

export function PlannerWorkflow({ active, onSelect, disabled = false }: {
  active: "room" | "catalog" | "materials" | null;
  onSelect: (step: "room" | "catalog" | "materials") => void;
  disabled?: boolean;
}) {
  return <nav className="planner-workflow" aria-label="Төлөвлөх алхмууд">
    {[{ id: "room", label: "Хэмжээ", Icon: House }, { id: "catalog", label: "Нэмэх", Icon: LayoutGrid },
      { id: "materials", label: "Тохижуулах", Icon: Paintbrush }].map(({ id, label, Icon }, index) =>
      <button key={id} type="button" disabled={disabled} aria-pressed={active === id}
        onClick={() => onSelect(id as "room" | "catalog" | "materials")}>
        <span className="workflow-number">{index + 1}</span><Icon size={15} aria-hidden="true"/><span>{label}</span>
      </button>)}
  </nav>;
}
