"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, X } from "lucide-react";
import {
  plannerTourSteps,
  type PlannerTourKind,
  type TourIllustration,
} from "./plannerTourSteps";
import "./planner-tour.css";

const dismissedTours = new Set<string>();
type Bounds = { left: number; top: number; width: number; height: number };

/** A schematic preview, kept separate from the user's actual room and design. */
function TourPreview({
  kind,
  scene,
}: {
  kind: PlannerTourKind;
  scene: TourIllustration;
}) {
  const kitchen = kind === "kitchen";
  return (
    <div className="planner-tour-preview" aria-hidden="true" data-scene={scene}>
      <div className="planner-tour-mini-bar">
        <span />
        <span />
        <span />
        <i />
        {kitchen ? "KITCHEN PLANNER" : "ROOM PLANNER"}
      </div>
      <svg viewBox="0 0 320 174" fill="none">
        <path
          d="M0 144 250 0M0 166 288 0M30 174 320 7M70 174 320 30M110 174 320 53M150 174 320 76M0 36 240 174M0 60 199 174M0 84 158 174M30 0 320 166M72 0 320 143M114 0 320 119"
          stroke="#dde2e8"
          strokeWidth=".5"
        />
        <path
          d="m65 91 102-58 105 59-104 62Z"
          fill={scene === "material" ? "#d6c3a6" : "#e6d9c6"}
          stroke="#c9bba7"
        />
        <path
          d="M65 91V43l102-57v47Z"
          fill="#f7f8fc"
          transform="translate(0 20)"
        />
        <path d="m167 6 105 60v46L167 53Z" fill="#e6eaf0" />
        <path
          d="m184 33 32 18v26l-32-18Z"
          fill="#c2daed"
          stroke="white"
          strokeWidth="4"
        />
        {kitchen ? (
          <g stroke="#8b9b98" strokeLinejoin="round">
            <path d="m92 89 73-42 22 13-73 42Z" fill="#f9faf7" />
            <path
              d="m114 102 73-42v31l-73 42Z"
              fill={scene === "material" ? "#8da797" : "#b3c4b9"}
            />
            <path d="m92 89 22 13v31l-22-13Z" fill="#8eaaa0" />
            <path d="M138 88v31m25-45v31m-19-16 10-6m16-8 9-5m-57 30 9-5" />
            <path d="m186 61 54 31-21 13-54-31Z" fill="#f9faf7" />
            <path
              d="m219 105 21-13v31l-21 13Zm-54-31 54 31v31l-32-19V87"
              fill="#b3c4b9"
            />
            <ellipse cx="207" cy="87" rx="11" ry="6" fill="#53636b" />
          </g>
        ) : (
          <g strokeLinejoin="round">
            <path
              d="m96 88 41-23 24 14-41 24Z"
              fill="#b7c6bc"
              stroke="#8fa799"
            />
            <path d="m96 88 24 15v23L96 112Z" fill="#8fa799" />
            <path
              d="m120 103 41-24v23l-41 24Z"
              fill={scene === "material" ? "#759c88" : "#a7bcae"}
            />
            <path d="m97 88 8-5 23 14 33-19v9l-41 24-23-14Z" fill="#c8d6cc" />
            <path
              d="m153 117 30-17 27 15-30 18Z"
              fill="#b99b79"
              stroke="#a38a6e"
            />
            <path
              d="M155 118v12m52-14v12m-27 5v11"
              stroke="#8d7860"
              strokeWidth="3"
            />
            <path d="M242 113V77" stroke="#8fa799" strokeWidth="3" />
            <ellipse cx="242" cy="75" rx="12" ry="15" fill="#9fb9a5" />
            <path d="m234 107 16 0-3 14h-10Z" fill="#e9d3ba" />
          </g>
        )}
        {scene === "size" && (
          <g stroke="#3c69ff" strokeWidth="1.5">
            <path d="m62 129 104 59m-107-55 6-9m98 68 6-9M54 116V65m-4 0h8m-8 51h8" />
            <rect
              x="95"
              y="146"
              width="44"
              height="19"
              rx="5"
              fill="white"
              stroke="none"
            />
            <text x="102" y="159" fill="#3c69ff" stroke="none" fontSize="11">
              4.0 м
            </text>
          </g>
        )}
        {scene === "place" && (
          <g stroke="#3c69ff" strokeWidth="2">
            <path d="m83 123 82-46 76 43-81 47Z" strokeDasharray="4 4" />
            <path d="m155 99 0 24m-12-12h24m-17-7 5-5 5 5m-10 14 5 5 5-5" />
          </g>
        )}
        {scene === "view" && (
          <path
            d="M70 130c-35 30 41 45 116 32 42-7 66-21 57-32m-7 3 7-4 4 8"
            stroke="#3c69ff"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
      </svg>
      {scene === "catalog" && (
        <div className="planner-tour-mini-catalog">
          <b>{kitchen ? "Шүүгээ" : "Тавилга"}</b>
          <div>
            {[1, 2, 3, 4].map((n) => (
              <span key={n}>
                <i />
                <small>+</small>
              </span>
            ))}
          </div>
        </div>
      )}
      {scene === "material" && (
        <div className="planner-tour-swatches">
          <span />
          <span />
          <span />
          <span />
          <Check size={12} />
        </div>
      )}
      {scene === "view" && (
        <div className="planner-tour-view-pill">
          2D <span>3D</span>
        </div>
      )}
      {scene === "save" && (
        <div className="planner-tour-saved">
          <span>
            <Check size={18} />
          </span>
          <div>
            <b>Миний {kitchen ? "гал тогоо" : "өрөө"}</b>
            <small>Хадгалахад бэлэн</small>
          </div>
        </div>
      )}
      <span className="planner-tour-preview-label">
        {kitchen ? "ГАЛ ТОГОО" : "МИНИЙ ӨРӨӨ"}
      </span>
    </div>
  );
}

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
