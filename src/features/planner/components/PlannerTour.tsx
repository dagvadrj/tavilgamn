"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, X } from "lucide-react";
import { plannerTourSteps, type PlannerTourKind } from "./plannerTourSteps";
import { TourPreview } from "./PlannerTourPreview";
import "./planner-tour.css";

const dismissedTours = new Set<string>();
type Bounds = { left: number; top: number; width: number; height: number };

export function PlannerTour({
  kind,
  enabled = true,
  request = 0,
}: {
  kind: PlannerTourKind;
  enabled?: boolean;
  request?: number;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [target, setTarget] = useState<Bounds | null>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const card = useRef<HTMLElement>(null);
  const checked = useRef(false);
  const lastRequest = useRef(request);
  const previousFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const storageKey = `tavilga:planner-tour:${kind}:v1`;
  const steps = plannerTourSteps[kind];
  const step = index === null ? null : steps[index];
  const open = enabled && step !== null;

  useEffect(() => {
    if (!enabled) return;
    const replay = request !== lastRequest.current;
    lastRequest.current = request;
    if (!replay && checked.current) return;
    checked.current = true;
    let seen = dismissedTours.has(storageKey);
    try {
      seen ||= localStorage.getItem(storageKey) === "done";
    } catch {
      /* Storage may be unavailable. */
    }
    if (replay || !seen) {
      setIndex(0);
      setExpanded(false);
    }
  }, [enabled, request, storageKey]);

  const dismiss = useCallback(() => {
    dismissedTours.add(storageKey);
    try {
      localStorage.setItem(storageKey, "done");
    } catch {
      /* Help remains available without storage. */
    }
    setIndex(null);
  }, [storageKey]);

  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    element.showModal();
    return () => {
      element.close();
      if (previousFocus.current?.isConnected)
        previousFocus.current.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (!open || !step) return;
    const anchor = document.querySelector<HTMLElement>(
      `[data-planner-tour="${step.target}"]`,
    );
    const update = () => {
      if (!card.current) return;
      const vw = window.innerWidth,
        vh = window.innerHeight,
        gap = 18,
        margin = 16;
      const rect = anchor?.getBoundingClientRect();
      const bounds =
        rect &&
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < vh &&
        rect.left < vw
          ? {
              left: Math.max(6, rect.left - 6),
              top: Math.max(6, rect.top - 6),
              width:
                Math.min(rect.right + 6, vw - 6) - Math.max(6, rect.left - 6),
              height:
                Math.min(rect.bottom + 6, vh - 6) - Math.max(6, rect.top - 6),
            }
          : null;
      setTarget(bounds);
      const { width, height } = card.current.getBoundingClientRect();
      let left = (vw - width) / 2,
        top = (vh - height) / 2;
      if (bounds && vw > 640) {
        if (bounds.left + bounds.width + gap + width <= vw - margin) {
          left = bounds.left + bounds.width + gap;
          top = bounds.top;
        } else if (bounds.left - gap - width >= margin) {
          left = bounds.left - gap - width;
          top = bounds.top;
        } else if (bounds.top + bounds.height + gap + height <= vh - margin) {
          top = bounds.top + bounds.height + gap;
          left = bounds.left;
        } else if (bounds.top - gap - height >= margin) {
          top = bounds.top - gap - height;
          left = bounds.left;
        }
      }
      setPosition({
        left: Math.max(margin, Math.min(left, vw - width - margin)),
        top: Math.max(margin, Math.min(top, vh - height - margin)),
      });
    };
    update();
    const observer = new ResizeObserver(update);
    if (anchor) observer.observe(anchor);
    if (card.current) observer.observe(card.current);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, step]);

  if (!open || !step || index === null) return null;
  const go = (next: number) => {
    setExpanded(false);
    setIndex(next);
  };
  return (
    <dialog
      ref={dialog}
      className="planner-tour"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
      }}
    >
      <div
        className={target ? "planner-tour-spotlight" : "planner-tour-shade"}
        style={target ?? undefined}
        aria-hidden="true"
      />
      <section
        ref={card}
        className="planner-tour-card"
        style={
          position ?? {
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
          }
        }
      >
        <TourPreview kind={kind} scene={step.illustration} />
        <button
          type="button"
          className="planner-tour-close"
          aria-label="Зааврыг хаах"
          onClick={dismiss}
        >
          <X size={17} />
        </button>
        <div className="planner-tour-content">
          <p className="planner-tour-eyebrow">
            {kind === "room" ? "ӨРӨӨНИЙ ТӨЛӨВЛӨГЧ" : "ГАЛ ТОГООНЫ ТӨЛӨВЛӨГЧ"} ·
            ТАНИЛЦАХ
          </p>
          <div aria-live="polite" aria-atomic="true">
            <h2 id={titleId}>
              <span>
                {index + 1}
                <small>/{steps.length}</small>
              </span>
              {step.title}
            </h2>
            <p id={descriptionId} className="planner-tour-description">
              {step.description}
            </p>
          </div>
          <button
            type="button"
            className="planner-tour-detail-toggle"
            aria-expanded={expanded}
            aria-controls={`${descriptionId}-detail`}
            onClick={() => setExpanded((value) => !value)}
          >
            Дэлгэрэнгүй <ChevronDown size={14} />
          </button>
          {expanded && (
            <p id={`${descriptionId}-detail`} className="planner-tour-detail">
              {step.detail}
            </p>
          )}
          <div
            className="planner-tour-progress"
            aria-label={`${steps.length} алхмаас ${index + 1}`}
          >
            {steps.map((item, i) => (
              <span key={item.target} data-active={i <= index} />
            ))}
          </div>
          <footer className="planner-tour-footer">
            <button
              type="button"
              className="planner-tour-skip"
              onClick={dismiss}
            >
              Алгасах
            </button>
            <div>
              {index > 0 && (
                <button
                  type="button"
                  className="planner-tour-back"
                  aria-label="Өмнөх алхам"
                  onClick={() => go(index - 1)}
                >
                  <ArrowLeft size={17} />
                </button>
              )}
              <button
                type="button"
                className="planner-tour-next"
                autoFocus
                onClick={() =>
                  index === steps.length - 1 ? dismiss() : go(index + 1)
                }
              >
                {index === steps.length - 1 ? (
                  <>
                    Эхэлцгээе <Check size={16} />
                  </>
                ) : (
                  <>
                    Дараах <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </footer>
        </div>
      </section>
    </dialog>
  );
}
