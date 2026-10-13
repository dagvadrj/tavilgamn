"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Minus, Plus, Scan, RotateCw, Copy, Trash2, MousePointer2, Move, Ruler } from "lucide-react";
import type { CabinetPose, ModularKitchen } from "@/lib/kitchenCabinets";
import { Plan } from "./PlannerPanels";
import "./kitchen-space-usability.css";

export function KitchenPlanWorkspace({
  kitchen,
  selectedId,
  disabled,
  onSelect,
  onStart,
  onMove,
  onEnd,
  onCancel,
  onRotate,
  onDuplicate,
  onDelete,
}: {
  kitchen: ModularKitchen;
  selectedId: string | null;
  disabled: boolean;
  onSelect: (id: string) => void;
  onStart: (id: string) => void;
  onMove: (id: string, pose: CabinetPose) => void;
  onEnd: () => void;
  onCancel: () => void;
  onRotate: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [moving, setMoving] = useState(true);
  const [layer, setLayer] = useState<"all" | "base" | "wall">("all");
  const [measurements, setMeasurements] = useState(true);
  const drag = useRef<{
    id: string;
    pointer: number;
    pose: CabinetPose;
    x: number;
    z: number;
    target: HTMLElement;
    matrix: DOMMatrix;
    svg: SVGSVGElement;
  } | null>(null);
  const frame = useRef<number | null>(null),
    pending = useRef<CabinetPose | null>(null);
  const callbacks = useRef({ onMove, onEnd, onCancel });
  callbacks.current = { onMove, onEnd, onCancel };
  const point = (event: PointerEvent<HTMLElement>) => {
    const svg =
      drag.current?.svg ??
      (event.currentTarget.querySelector(
        "svg.km-plan",
      ) as SVGSVGElement | null);
    const matrix = drag.current?.matrix ?? svg?.getScreenCTM()?.inverse();
    if (!matrix || !svg) return null;
    const p = svg.createSVGPoint();
    p.x = event.clientX;
    p.y = event.clientY;
    return p.matrixTransform(matrix);
  };
  const finish = (cancel = false) => {
    const current = drag.current;
    if (!current) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    pending.current = null;
    drag.current = null;
    if (current.target.hasPointerCapture(current.pointer))
      current.target.releasePointerCapture(current.pointer);
    if (cancel) callbacks.current.onCancel();
    else callbacks.current.onEnd();
  };
  useEffect(() => {
    const cancel = () => finish(true);
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && drag.current) {
        event.preventDefault();
        cancel();
      }
    };
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keydown", key);
      cancel();
    };
    // Callbacks are kept current without interrupting a pointer gesture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const move = (event: PointerEvent<HTMLElement>, flush = false) => {
    const current = drag.current,
      p = point(event);
    if (!current || current.pointer !== event.pointerId || !p) return;
    pending.current = {
      ...current.pose,
      x: Math.round(p.x + current.x),
      z: Math.round(p.y + current.z),
    };
    const apply = () => {
      frame.current = null;
      if (drag.current && pending.current)
        callbacks.current.onMove(drag.current.id, pending.current);
      pending.current = null;
    };
    if (flush) {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      apply();
    } else if (frame.current === null)
      frame.current = requestAnimationFrame(apply);
  };
  return (
    <section
      className="kitchen-plan-workspace"
      aria-label="2D байрлуулах редактор"
    >
      <div className="kspace-map-toolbar">
        <div role="group" aria-label="Төлөвлөгөөний горим">
          <button type="button" aria-pressed={!moving} onClick={() => { finish(true); setMoving(false); }}><MousePointer2 size={16}/> Сонгох</button>
          <button type="button" aria-pressed={moving} disabled={disabled} onClick={() => setMoving(true)}><Move size={16}/> Зөөх</button>
        </div>
        <div role="group" aria-label="Шүүгээний давхарга">{([{ id: "base", label: "Доод" }, { id: "wall", label: "Дээд" }, { id: "all", label: "Бүгд" }] as const).map(option => <button type="button" key={option.id} aria-pressed={layer === option.id} onClick={() => { finish(true); setLayer(option.id); }}>{option.label}</button>)}</div>
        <button type="button" aria-pressed={measurements} onClick={() => setMeasurements(value => !value)}><Ruler size={16}/> Хэмжээс</button>
      </div>
      <div className="kitchen-plan-scroll">
        <div
          className="kitchen-plan-sheet"
          style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
          onPointerDown={(event) => {
            if (disabled || event.button !== 0 || drag.current) return;
            const id = (event.target as Element)
              .closest("[data-piece-id]")
              ?.getAttribute("data-piece-id");
            const piece = [...kitchen.cabinets, ...(kitchen.extras ?? [])].find(
                (c) => c.id === id,
              ),
              p = point(event);
            const svg = event.currentTarget.querySelector(
                "svg.km-plan",
              ) as SVGSVGElement | null,
              matrix = svg?.getScreenCTM()?.inverse();
            if (!piece || !p || !svg || !matrix) return;
            if (!moving) { onSelect(piece.id); return; }
            event.preventDefault();
            onSelect(piece.id);
            onStart(piece.id);
            drag.current = {
              id: piece.id,
              pointer: event.pointerId,
              pose: { ...piece.position },
              x: piece.position.x - p.x,
              z: piece.position.z - p.y,
              target: event.currentTarget,
              svg,
              matrix,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => move(event)}
          onPointerUp={(event) => {
            if (drag.current?.pointer === event.pointerId) {
              move(event, true);
              finish();
            }
          }}
          onPointerCancel={() => finish(true)}
          onLostPointerCapture={() => finish(true)}
        >
          <Plan unit="см" kitchen={kitchen} selectedId={selectedId} onSelect={onSelect} layer={layer} showMeasurements={measurements}/>
        </div>
      </div>
      {selectedId && (
        <div
          className="kitchen-plan-context"
          role="group"
          aria-label="Сонгосон тавилгын үйлдэл"
        >
          <button type="button" disabled={disabled} onClick={onRotate}>
            <RotateCw size={16} /> Эргүүлэх
          </button>
          <button type="button" disabled={disabled} onClick={onDuplicate}>
            <Copy size={16} /> Хувилах
          </button>
          <button type="button" disabled={disabled} onClick={onDelete}>
            <Trash2 size={16} /> Устгах
          </button>
        </div>
      )}
      <div
        className="kitchen-plan-zoom"
        role="group"
        aria-label="2D зургийн масштаб"
      >
        <button
          type="button"
          aria-label="2D ойртуулах"
          onClick={() => setZoom((v) => Math.min(3, v + 0.25))}
        >
          <Plus size={18} />
        </button>
        <button
          type="button"
          aria-label="2D бүх өрөөг багтаах"
          onClick={() => setZoom(1)}
        >
          <Scan size={18} />
        </button>
        <button
          type="button"
          aria-label="2D холдуулах"
          onClick={() => setZoom((v) => Math.max(1, v - 0.25))}
        >
          <Minus size={18} />
        </button>
      </div>
      <aside className="kitchen-plan-minimap" aria-label="Өрөөний тойм">
        <span>
          Өрөөний тойм <i />
        </span>
        <Plan
          kitchen={kitchen}
          selectedId={selectedId}
          onSelect={() => {}}
          readOnly
          showMeasurements={false}
          unit="см"
        />
        <small>
          {kitchen.room.width / 10} × {kitchen.room.depth / 10} см
        </small>
      </aside>
      <footer>
        <span>{moving ? "Чирж зөөнө · Хана, шүүгээнд тааруулна" : "Тавилга дээр дарж сонгоно"}</span>
        <span>Бүх хэмжээ см · {Math.round(zoom * 100)}%</span>
      </footer>
    </section>
  );
}
