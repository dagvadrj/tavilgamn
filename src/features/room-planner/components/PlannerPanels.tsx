"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn, formatPrice } from "@/lib/format";
import type { RoomDesign } from "@/lib/types";
import { priceFor } from "@/lib/products";
import { getProduct } from "@/store/catalog";
import { getDbModel } from "@/lib/modelRegistry";
import { getRoomGeometry, roomPath } from "@/lib/roomGeometry";
import { pieceRects } from "@/three/collision";

export function Drawer({
  side,
  open,
  onClose,
  title,
  active = true,
  children,
}: {
  side: "left" | "right";
  open: boolean;
  onClose: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!active || !open || window.matchMedia("(min-width: 960px)").matches) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const elements = () =>
      Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input, select, summary, [tabindex="0"]',
        ) ?? [],
      ).filter((element) => element.getClientRects().length);
    elements()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeRef.current();
      }
      if (event.key !== "Tab") return;
      const items = elements();
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    const drawer = drawerRef.current;
    drawer?.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      drawer?.removeEventListener("keydown", handleKey);
      if (previous?.isConnected) previous.focus();
    };
  }, [open, active]);
  if (!active) return null;
  return (
    <>
      {/* mobile backdrop */}
      {open && (
        <div
          onClick={onClose}
          className="planner-drawer-backdrop fixed inset-0 z-[60] bg-[#293C32]/40 xl:hidden"
        />
      )}
      <aside
        ref={drawerRef}
        aria-label={title}
        className={cn(
          "planner-drawer fixed inset-y-0 z-[70] flex w-[88vw] max-w-[340px] flex-col bg-[#FAF9F6] shadow-2xl transition-transform duration-300 xl:relative xl:z-auto xl:w-auto xl:max-w-none xl:translate-x-0 xl:shadow-none",
          side === "left"
            ? "left-0 border-r border-[#293C32]/10 xl:flex"
            : "right-0 border-l border-[#293C32]/10 xl:flex",
          !open && "planner-drawer-closed",
          !open && side === "left" && "-translate-x-full xl:translate-x-0",
          !open && side === "right" && "translate-x-full xl:translate-x-0",
        )}
      >
        <div className="planner-drawer-heading flex items-center justify-between border-b border-[#293C32]/10 p-4 xl:hidden">
          <p className="text-lg text-[#293C32]">{title}</p>
          <button
            onClick={onClose}
            aria-label="Самбар хаах"
            className="grid h-9 w-9 place-items-center rounded-full hover:bg-[#293C32]/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="planner-drawer-body flex flex-1 flex-col">
          {children}
        </div>
      </aside>
    </>
  );
}

export function CompareModal({
  designs,
  onClose,
  onLoad,
}: {
  designs: RoomDesign[];
  onClose: () => void;
  onLoad: (id: string) => void;
}) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[80] grid place-items-center bg-[#293C32]/60 p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-lg bg-[#FAF9F6] p-8"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl text-[#293C32]">Загваруудыг харьцуулах</h2>
          <button onClick={onClose} className="btn-ghost !py-2">
            Хаах
          </button>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
          {designs.map((d) => {
            const total = d.pieces.reduce((sum, piece) => {
              const product = getProduct(piece.productId);
              if (product) {
                return sum + priceFor(product, piece.color, piece.material);
              }
              const model = getDbModel(piece.modelId ?? piece.productId);
              if (!model) return sum;

              const colorDelta =
                model.colors.find((color) => color.id === piece.color)
                  ?.priceDelta ?? 0;

              const materialDelta =
                model.materials.find(
                  (material) => material.id === piece.material,
                )?.priceDelta ?? 0;
              return sum + model.basePrice + colorDelta + materialDelta;
            }, 0);
            return (
              <div key={d.id} className="card overflow-hidden">
                <div className="aspect-video bg-[#EEEEE7]">
                  <MiniTopDown design={d} />
                </div>
                <div className="p-5">
                  <p className="text-lg text-[#293C32]">{d.name}</p>
                  <p className="text-xs text-[#6C726B]">
                    {d.roomName ?? "Зочны өрөө"} ·{" "}
                    {getRoomGeometry(d).area.toFixed(1)} м²
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="label">Тавилга</p>
                      <p className="font-mono font-medium text-[#293C32]">
                        {d.pieces.length}
                      </p>
                    </div>
                    <div>
                      <p className="label">Нийт үнэ</p>
                      <p className="font-mono font-medium text-[#293C32]">
                        {formatPrice(total)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onLoad(d.id)}
                    className="btn-primary mt-4 w-full !py-2.5"
                  >
                    Энэ загварыг нээх
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MiniTopDown({ design }: { design: RoomDesign }) {
  const scale = 32;
  const { bounds } = getRoomGeometry(design);
  return (
    <svg
      viewBox={`${bounds.minX * scale - 4} ${bounds.minZ * scale - 4} ${(bounds.maxX - bounds.minX) * scale + 8} ${(bounds.maxZ - bounds.minZ) * scale + 8}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        d={roomPath(design, scale)}
        fill={design.floorColor}
        fillRule="evenodd"
        stroke={design.wallColor}
        strokeWidth={4}
      />
      {(design.columns ?? []).map((column) => (
        <rect
          key={column.id}
          x={(column.x - design.width / 2) * scale}
          y={(column.z - design.depth / 2) * scale}
          width={column.width * scale}
          height={column.depth * scale}
          fill={design.wallColor}
          stroke="#737b73"
          strokeWidth={1}
        />
      ))}
      {design.pieces.map((p) => {
        if (p.kitchen)
          return (
            <g key={p.instanceId}>
              {pieceRects(p).map((r, i) => (
                <rect
                  key={i}
                  transform={`translate(${r.cx * scale} ${r.cz * scale}) rotate(${(r.rot * 180) / Math.PI})`}
                  x={(-r.w * scale) / 2}
                  y={(-r.d * scale) / 2}
                  width={r.w * scale}
                  height={r.d * scale}
                  fill={p.kitchen!.design.cabinets[0]?.color ?? "#bb915e"}
                  stroke="#293c32"
                  strokeWidth={0.6}
                />
              ))}
            </g>
          );
        const product = getProduct(p.productId);
        const dbModel = getDbModel(p.modelId ?? p.productId);

        if (!product && !dbModel) return null;

        const dimensions = product
          ? product.dimensions
          : {
              w: dbModel!.dimensionsW,
              d: dbModel!.dimensionsD,
              h: dbModel!.dimensionsH,
            };
        const colors = product ? product.colors : dbModel!.colors;

        const px = p.x * scale;
        const py = p.z * scale;
        const pw = dimensions.w * scale;
        const pd = dimensions.d * scale;
        const col = colors.find((color) => color.id === p.color)?.hex ?? "#888";
        const rotDeg = (-p.rotation * 180) / Math.PI;
        return (
          <g
            key={p.instanceId}
            transform={`translate(${px} ${py}) rotate(${rotDeg})`}
          >
            <rect
              x={-pw / 2}
              y={-pd / 2}
              width={pw}
              height={pd}
              fill={col}
              stroke="#1A1814"
              strokeWidth={1}
              opacity={0.85}
            />
          </g>
        );
      })}
    </svg>
  );
}

export function NumberControl({
  label,
  value,
  min,
  max,
  step,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const cancelled = useRef(false);
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <label className="planner-number">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step="any"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            cancelled.current = true;
            setDraft(String(value));
            event.currentTarget.blur();
          }
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            setDraft(
              String(
                Math.max(
                  min,
                  Math.min(
                    max,
                    Math.round(
                      (Number(draft) +
                        (event.key === "ArrowUp" ? step : -step)) *
                        100,
                    ) / 100,
                  ),
                ),
              ),
            );
          }
        }}
        onBlur={() => {
          const next = Number(draft);
          if (
            !cancelled.current &&
            draft.trim() &&
            Number.isFinite(next) &&
            next >= min &&
            next <= max
          )
            onCommit(next);
          cancelled.current = false;
          setDraft(String(value));
        }}
      />
    </label>
  );
}

export function PlannerSkeleton() {
  return (
    <div className="grid h-full w-full place-items-center bg-[#EEEEE7]">
      <div className="text-sm text-[#6C726B]">
        Өрөөний төлөвлөгчийг ачаалж байна…
      </div>
    </div>
  );
}
