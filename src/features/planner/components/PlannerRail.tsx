"use client";
import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";

export interface PlannerRailItem {
  id: string;
  label: string;
  Icon: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

/** Navigation only: changing an inspector never resets the scene or project. */
export function PlannerRail({ items }: { items: PlannerRailItem[] }) {
  return <nav className="planner-reference-rail" aria-label="Төлөвлөгчийн хэрэгслүүд">
    <div className="planner-reference-rail-items">
      {items.map(({ id, label, Icon, active, disabled, onClick }) => <button
        key={id} type="button" title={label} aria-label={label}
        aria-pressed={active} disabled={disabled} onClick={onClick}>
        <Icon size={19} strokeWidth={1.7} /><span>{label}</span>
      </button>)}
    </div>
    <Link href="/" title="Дэлгүүр рүү буцах" aria-label="Дэлгүүр рүү буцах"><ArrowLeft size={19} /><span>Дэлгүүр рүү буцах</span></Link>
  </nav>;
}
