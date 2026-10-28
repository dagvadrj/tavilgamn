"use client";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { placeSelectionToolbar } from "@/lib/roomProductOptions";
import { useSelectionAnchor } from "@/store/selectionAnchor";

/** Stage pixels hidden under a side panel that floats over it (tablet drawer). */
function coveredLeft(stage: DOMRect) {
  const panel = document.querySelector<HTMLElement>(".room-workspace-panel:not([data-sheet])");
  if (!panel) return 0;
  const box = panel.getBoundingClientRect();
  if (box.width === 0 || box.left > stage.left + 1 || box.right <= stage.left) return 0;
  return Math.min(stage.width, box.right - stage.left);
}

export interface SelectionAction {
  id: string;
  label: string;
  icon: ReactNode;
  run: () => void;
  disabled?: string;
  primary?: boolean;
}

/**
 * Contextual actions for one selected instance. On desktop it follows the
 * object's projected bounds (written by the canvas only on rendered frames)
 * through a direct style write, so camera motion never re-renders the planner.
 * Without a visible anchor, or while the camera is focused on the piece, it
 * docks at the top of the stage.
 */
export function RoomSelectionToolbar({
  instanceId,
  title,
  number,
  actions,
  onOpen,
  onClose,
  docked = false,
  panelOpen = false,
}: {
  instanceId: string;
  title: string;
  number: number;
  actions: SelectionAction[];
  /** Opens the product options; absent while they are already open. */
  onOpen?: () => void;
  onClose: () => void;
  /** «Төвлөрүүлэх» changes the bounds every frame; the bar stays put. */
  docked?: boolean;
  /** A tablet drawer covers the left of the stage; the bar keeps clear of it. */
  panelOpen?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const apply = () => {
      const bar = ref.current;
      const stage = bar?.offsetParent;
      if (!bar || !stage) return;
      const { instanceId: id, rect } = useSelectionAnchor.getState();
      const box = stage.getBoundingClientRect();
      const inset = coveredLeft(box);
      const width = box.width - inset;
      bar.style.setProperty("--sel-max", `${Math.max(0, Math.round(width - 16))}px`);
      bar.style.setProperty("--sel-dock-x", `${Math.round(inset + width / 2)}px`);
      // In a narrow visible stage the title (shown by the panel) gives way.
      bar.dataset.compact = String(width < 720);
      const placed =
        id === instanceId && rect && !docked
          ? placeSelectionToolbar(
              { left: rect.left - box.left - inset, top: rect.top - box.top, right: rect.right - box.left - inset, bottom: rect.bottom - box.top },
              { width, height: box.height },
              { width: bar.offsetWidth, height: bar.offsetHeight },
              { gap: 12, margin: 8 },
            )
          : null;
      bar.dataset.anchor = placed ? "on" : "off";
      if (placed) {
        bar.style.setProperty("--sel-x", `${Math.round(placed.x + inset)}px`);
        bar.style.setProperty("--sel-y", `${Math.round(placed.y)}px`);
      }
    };
    apply();
    const unsubscribe = useSelectionAnchor.subscribe(apply);
    window.addEventListener("resize", apply);
    // The drawer slides; measure again once it has settled.
    window.addEventListener("transitionend", apply);
    return () => {
      unsubscribe();
      window.removeEventListener("resize", apply);
      window.removeEventListener("transitionend", apply);
    };
  }, [instanceId, actions.length, docked, panelOpen]);

  return (
    <div
      ref={ref}
      className="room-selection-bar is-floating"
      data-anchor="off"
      role="toolbar"
      aria-label={`Сонгосон тавилга: ${title}`}
      // Toolbar presses must never reach the scene's select/drag/look handlers.
      onPointerDown={(event) => event.stopPropagation()}
    >
      {onOpen ? (
        <button type="button" className="room-selection-title" title="Бүтээгдэхүүний сонголт нээх" onClick={onOpen}>
          <strong>
            {title} <small>#{number}</small>
          </strong>
        </button>
      ) : (
        <strong title={title}>
          {title} <small>#{number}</small>
        </strong>
      )}
      <span aria-hidden="true" />
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className={action.primary ? "is-primary" : undefined}
          disabled={!!action.disabled}
          title={action.disabled ?? action.label}
          aria-label={action.disabled ? `${action.label} — ${action.disabled}` : action.label}
          onClick={action.run}
        >
          {action.icon}
          <span>{action.label}</span>
        </button>
      ))}
      <button type="button" aria-label="Сонголт цуцлах" title="Сонголт цуцлах" onClick={onClose}>
        <X size={16} />
      </button>
    </div>
  );
}
