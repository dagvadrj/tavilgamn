"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ArrowLeft, ChevronLeft, PanelLeftOpen, X } from "lucide-react";
import type {
  RoomPanelTab,
  RoomPanelView,
} from "@/features/room-planner/hooks/useRoomPlannerUi";

export const ROOM_PANEL_TABS: { id: RoomPanelTab; label: string }[] = [
  { id: "add", label: "Тавилга нэмэх" },
  { id: "added", label: "Нэмсэн тавилга" },
  { id: "cart", label: "Сагсалсан тавилга" },
];

const PHONE = "(max-width: 599px)";
const subscribePhone = (change: () => void) => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return () => {};
  const query = window.matchMedia(PHONE);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
};
const isPhone = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia(PHONE).matches;

/** Phones show the panel as a bottom sheet: peek (closed) → half → full. */
export type RoomSheet = "peek" | "half" | "full";

/** Accessible name of the control that opened a nested view, to return to it. */
const controlName = (element: Element | null) =>
  element instanceof HTMLElement
    ? (element.getAttribute("aria-label") ?? element.textContent ?? "").trim()
    : "";

/**
 * One floating left panel. Closing it only moves the stage; tab, nested view,
 * search and camera stay as they were. Nested views keep the list scroll.
 */
export function RoomWorkspacePanel({
  open,
  onOpenChange,
  tab,
  onTab,
  view,
  onBack,
  meta,
  nestedEyebrow,
  nestedTitle,
  onNestedClose,
  footer,
  peekLine,
  labels,
  expandRequest = 0,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: RoomPanelTab;
  onTab: (tab: RoomPanelTab) => void;
  view: RoomPanelView;
  onBack: () => void;
  meta: Record<RoomPanelTab, string>;
  nestedEyebrow?: string;
  nestedTitle?: string;
  /** D1 product options: «×» clears the selection; the piece stays in the room. */
  onNestedClose?: { label: string; run: () => void };
  footer?: React.ReactNode;
  /** Phone peek: one line «N тавилга өрөөнд · ₮ · сагсанд N ш». */
  peekLine?: string;
  /** Merchant editor (C3) names the three tabs after its own work. */
  labels?: Record<RoomPanelTab, string>;
  /** D5: bumped by «Солих» / «Хослуулах»; a phone sheet opens to full height. */
  expandRequest?: number;
  children: React.ReactNode;
}) {
  const phone = useSyncExternalStore(subscribePhone, isPhone, () => false);
  const [full, setFull] = useState(false);
  const sheet: RoomSheet = !open ? "peek" : full ? "full" : "half";
  const panel = useRef<HTMLElement>(null);
  const reopen = useRef<HTMLButtonElement>(null);
  const opener = useRef("");
  const previous = useRef({ open, view });
  // B3: Escape/«Буцах» goes down one level and focus returns to the control
  // that opened it (a nested view's opener, or the panel's own open control).
  useEffect(() => {
    const before = previous.current;
    previous.current = { open, view };
    const active = document.activeElement;
    const focusWasInside =
      !active || active === document.body || !!panel.current?.contains(active);
    if (before.open && !open) {
      if (focusWasInside) reopen.current?.focus();
      return;
    }
    if (before.view === "list" && view !== "list" && open && focusWasInside) {
      // A nested view opened from the panel starts at its «Буцах».
      panel.current
        ?.querySelector<HTMLElement>(".room-panel-nested-header button")
        ?.focus();
      return;
    }
    if (before.view !== "list" && view === "list" && open) {
      const root = panel.current;
      const name = opener.current;
      const match = name
        ? Array.from(
            root?.querySelectorAll<HTMLElement>("#room-panel-content button") ??
              [],
          ).find((button) => controlName(button) === name)
        : undefined;
      (
        match ??
        root?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
      )?.focus();
    }
  }, [open, view]);
  useEffect(() => {
    if (!open) setFull(false);
  }, [open]);
  useEffect(() => {
    if (expandRequest > 0 && isPhone()) setFull(true);
  }, [expandRequest]);
  const scroller = useRef<HTMLDivElement>(null);
  const offsets = useRef(new Map<string, number>());
  const key = view === "list" ? tab : view;
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    element.scrollTop = offsets.current.get(key) ?? 0;
    const remember = () => offsets.current.set(key, element.scrollTop);
    element.addEventListener("scroll", remember, { passive: true });
    return () => element.removeEventListener("scroll", remember);
  }, [key, open]);
  const tabs = labels
    ? ROOM_PANEL_TABS.map((item) => ({ ...item, label: labels[item.id] }))
    : ROOM_PANEL_TABS;
  const label = tabs.find((item) => item.id === tab)!.label;
  if (!open && !phone)
    return (
      <button
        ref={reopen}
        type="button"
        className="room-panel-open-button"
        aria-label={`Самбар нээх · ${label}`}
        onClick={() => onOpenChange(true)}
      >
        <PanelLeftOpen size={18} aria-hidden="true" />
        <span>{label}</span>
      </button>
    );
  const moveTab = (event: React.KeyboardEvent, index: number) => {
    const step =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next =
      ROOM_PANEL_TABS[
        (index + step + ROOM_PANEL_TABS.length) % ROOM_PANEL_TABS.length
      ];
    onTab(next.id);
    if (!open) onOpenChange(true);
    (
      event.currentTarget.parentElement?.querySelector(
        `[data-tab="${next.id}"]`,
      ) as HTMLElement | null
    )?.focus();
  };
  return (
    <>
      {!phone && (
        <div
          className="room-panel-backdrop"
          aria-hidden="true"
          onClick={() => onOpenChange(false)}
        />
      )}
      <aside
        ref={panel}
        className="room-workspace-panel"
        aria-label="Төлөвлөгчийн самбар"
        data-view={view}
        data-sheet={phone ? sheet : undefined}
        onClickCapture={(event) => {
          // Remember which control opens a nested view, for focus on «Буцах».
          if (view === "list")
            opener.current = controlName(
              (event.target as Element).closest("button"),
            );
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || event.defaultPrevented) return;
          const target = event.target as HTMLElement;
          if (target.closest("input, select, textarea, details[open]")) return;
          event.preventDefault();
          if (view !== "list") onBack();
          else if (full) setFull(false);
          else onOpenChange(false);
        }}
      >
        {phone && (
          <button
            ref={reopen}
            type="button"
            className="room-sheet-grabber"
            aria-label={
              sheet === "full" ? "Самбарыг багасгах" : "Самбарыг томруулах"
            }
            aria-expanded={open}
            onClick={() => {
              if (sheet === "peek") onOpenChange(true);
              else if (sheet === "half") setFull(true);
              else onOpenChange(false);
            }}
          >
            <span aria-hidden="true" />
          </button>
        )}
        {!phone && (
          <button
            type="button"
            className="room-panel-handle"
            aria-label="Самбар хаах — камер хэвээр үлдэнэ"
            title="Самбар хаах"
            onClick={() => onOpenChange(false)}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
        )}
        {view === "list" ? (
          <div
            className="room-panel-tabs"
            role="tablist"
            aria-label="Самбарын хэсгүүд"
          >
            {tabs.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`room-panel-tab-${item.id}`}
                data-tab={item.id}
                aria-selected={tab === item.id}
                aria-controls={open ? "room-panel-content" : undefined}
                tabIndex={tab === item.id ? 0 : -1}
                onClick={() => {
                  onTab(item.id);
                  // A tab pressed on the peek sheet opens it to half height.
                  if (!open) onOpenChange(true);
                }}
                onKeyDown={(event) => moveTab(event, index)}
              >
                <span>{item.label}</span>
                <small>{meta[item.id]}</small>
              </button>
            ))}
          </div>
        ) : (
          <div className="room-panel-nested-header">
            <button type="button" onClick={onBack}>
              <ArrowLeft size={16} aria-hidden="true" /> Буцах
            </button>
            <div>
              {nestedEyebrow && <span>{nestedEyebrow}</span>}
              <strong>{nestedTitle}</strong>
            </div>
            {onNestedClose && (
              <button
                type="button"
                className="room-panel-nested-close"
                aria-label={onNestedClose.label}
                title={onNestedClose.label}
                onClick={onNestedClose.run}
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
        {sheet === "peek" && phone ? (
          peekLine && <p className="room-sheet-peek">{peekLine}</p>
        ) : (
          <div
            ref={scroller}
            id="room-panel-content"
            className="room-panel-scroll"
            role={view === "list" ? "tabpanel" : "region"}
            aria-labelledby={
              view === "list" ? `room-panel-tab-${tab}` : undefined
            }
            aria-label={view === "list" ? undefined : nestedTitle}
          >
            {children}
          </div>
        )}
        {footer && open && <div className="room-panel-footer">{footer}</div>}
      </aside>
    </>
  );
}
