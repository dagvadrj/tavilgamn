"use client";

import { useRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

/** A real button for keyboard users; dragging only this grip never moves furniture. */
export function PlannerSheetGrip({
  expanded,
  onExpand,
  onClose,
}: {
  expanded: boolean;
  onExpand: (value: boolean) => void;
  onClose: () => void;
}) {
  const start = useRef<number | null>(null),
    dragged = useRef(false);
  return (
    <button
      type="button"
      className="planner-sheet-grip"
      aria-expanded={expanded}
      aria-label={expanded ? "Самбарыг хураах" : "Самбарыг дэлгэрүүлэх"}
      onPointerDown={(event) => {
        start.current = event.clientY;
        dragged.current = false;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerUp={(event) => {
        if (start.current === null) return;
        const delta = event.clientY - start.current;
        start.current = null;
        if (Math.abs(delta) < 40) return;
        dragged.current = true;
        if (delta < 0) onExpand(true);
        else if (expanded) onExpand(false);
        else onClose();
      }}
      onPointerCancel={() => {
        start.current = null;
        dragged.current = true;
      }}
      onClick={() => {
        if (dragged.current) {
          dragged.current = false;
          return;
        }
        onExpand(!expanded);
      }}
    >
      <span className="planner-sheet-handle" aria-hidden="true" />
      <span>{expanded ? "Хураах" : "Дэлгэрүүлэх"}</span>
      {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
    </button>
  );
}
