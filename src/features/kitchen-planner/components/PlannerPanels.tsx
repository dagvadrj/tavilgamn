"use client";
import { useId, useRef, type PointerEvent } from "react";
import "./kitchen-plan.css";
import { roomOutline, roomOutlinePath } from "@/lib/kitchenRoomOutline";
import { cabinetAxes, cabinetCorners, placementIssues } from "@/lib/kitchenPlacement";
import { cabinetLabel, type ModularKitchen, type CabinetPose } from "@/lib/kitchenCabinets";
import { roomOutline, roomOutlinePath } from "@/lib/kitchenRoomOutline";

export function DimensionInput({
  label,
  value,
  min,
  max,
  onCommit,
  disabled = false,
  unit = "мм",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  unit?: "мм" | "см";
  onCommit: (value: number) => void;
}) {
  const scale = unit === "см" ? 10 : 1;
  return (
    <label className="kp-field">
      <span>{label}</span>
      <span className="kp-number">
        <input
          key={`${value}-${unit}`}
          type="number"
          defaultValue={value / scale}
          min={min / scale}
          max={max / scale}
          step={unit === "см" ? 0.1 : 0.001}
          disabled={disabled}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          onBlur={(event) => {
            const next = event.currentTarget.valueAsNumber * scale;
            if (Number.isFinite(next) && next >= min && next <= max)
              onCommit(next);
            event.currentTarget.value = String(value / scale);
          }}
        />
        <span>{unit}</span>
      </span>
      <small>
        {min / scale}–{max / scale} {unit}
      </small>
    </label>
  );
}
export function Plan({
  kitchen,
  selectedId,
  onSelect,
  readOnly = false,
  unit = "мм",
  showSpaceItems = true,
  onStart,
  onMove,
  onEnd,
  layer = "all",
  showMeasurements = true,
}: {
  kitchen: ModularKitchen;
  selectedId: string | null;
  onSelect: (id: string) => void;
  readOnly?: boolean;
  unit?: "мм" | "см";
  showSpaceItems?: boolean;
  onStart?: (id: string) => void;
  onMove?: (id: string, pose: CabinetPose) => void;
  onEnd?: (cancel?: boolean) => void;
  layer?: "all" | "base" | "wall";
  showMeasurements?: boolean;
}) {
  const drag = useRef<{ id: string; pointerId: number; x: number; z: number; pose: CabinetPose } | null>(null);
  function point(event: PointerEvent<SVGElement>) {
    const svg = event.currentTarget instanceof SVGSVGElement ? event.currentTarget : event.currentTarget.ownerSVGElement;
    const matrix = svg?.getScreenCTM();
    return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : null;
  }
  const selected = [...kitchen.cabinets, ...(kitchen.extras ?? [])].find(item => item.id === selectedId);
  const corners = selected ? cabinetCorners(selected) : [];
  const minX = Math.min(...corners.map(p => p.x)), maxX = Math.max(...corners.map(p => p.x));
  const minZ = Math.min(...corners.map(p => p.z)), maxZ = Math.max(...corners.map(p => p.z));
  const dimension = (x1: number, z1: number, x2: number, z2: number, label: string) => Math.hypot(x2-x1, z2-z1) < 1 ? null : <g pointerEvents="none">
    <line x1={x1} y1={z1} x2={x2} y2={z2} stroke="#246847" strokeWidth={8}/>
    <text x={(x1+x2)/2} y={(z1+z2)/2-25} textAnchor="middle" fontSize={65} fill="#164b32" stroke="#fff" strokeWidth={18} paintOrder="stroke">{label}</text>
  </g>;
  const format = (value: number) => `${Math.round(value / unitScale * 10) / 10} ${unit}`;
  const unitScale = unit === "см" ? 10 : 1;
  const floorPattern = useId().replace(/:/g, "");
  const errors = new Set(
    placementIssues(kitchen)
      .filter((issue) => issue.severity === "error")
      .flatMap((issue) => issue.ids),
  );
  const cabinets = kitchen.cabinets.filter(cabinet => layer === "all" || (layer === "wall" ? cabinet.type === "wall" : cabinet.type !== "wall")).sort(
    (a, b) => Number(a.type === "wall") - Number(b.type === "wall"),
  );
  return (
    <svg
      className={`km-plan${readOnly ? " is-read-only" : ""}`}
      viewBox={`-200 -200 ${kitchen.room.width + 450} ${kitchen.room.depth + 400}`}
      role="group"
      aria-label="Модуль шүүгээний дээрээс харах зураг"
      style={{ touchAction: onMove ? "none" : undefined }}
      onPointerMove={event => {
        const active = drag.current, p = point(event);
        if (active && active.pointerId === event.pointerId && p) onMove?.(active.id, { ...active.pose, x: active.pose.x + p.x - active.x, z: active.pose.z + p.y - active.z });
      }}
      onPointerUp={event => { if (drag.current?.pointerId === event.pointerId) { drag.current = null; onEnd?.(); } }}
      onPointerCancel={() => { if (drag.current) { drag.current = null; onEnd?.(true); } }}
      onLostPointerCapture={() => { if (drag.current) { drag.current = null; onEnd?.(true); } }}
    >
      <defs>
        <pattern
          id={floorPattern}
          width="600"
          height="200"
          patternUnits="userSpaceOnUse"
        >
          <rect width="600" height="200" fill="#ead7b6" />
          <path
            d="M0 1h600M0 199h600M1 0v200M250 80h280M50 140h190"
            stroke="#ddc6a4"
            strokeWidth="8"
          />
        </pattern>
      </defs>
      <path
        d={roomOutlinePath(roomOutline(kitchen.room))}
        className="km-room-outline"
        style={{ fill: `var(--kitchen-plan-floor, url(#${floorPattern}))` }}
      />
      <path
        d={`M0 -130H${kitchen.room.width}M0 -160v60M${kitchen.room.width} -160v60`}
        fill="none"
        stroke="#687665"
        strokeWidth="8"
      />
      <text
        x={kitchen.room.width / 2}
        y={-60}
        textAnchor="middle"
        fontSize={70}
      >
        {kitchen.room.width / unitScale} {unit}
      </text>
      <text
        x={kitchen.room.width + 80}
        y={kitchen.room.depth / 2}
        textAnchor="middle"
        fontSize={70}
        transform={`rotate(90 ${kitchen.room.width + 80} ${kitchen.room.depth / 2})`}
      >
        {kitchen.room.depth / unitScale} {unit}
      </text>
      {showSpaceItems &&
        (kitchen.room.items ?? []).map((item) => {
          const angle =
            item.wall === "left"
              ? 90
              : item.wall === "right"
                ? -90
                : item.wall === "front"
                  ? 180
                  : 0;
          return (
            <g
              key={item.id}
              transform={`translate(${item.x} ${item.z}) rotate(${angle})`}
              pointerEvents="none"
            >
              {item.kind === "window" ? (
                <>
                  <path
                    d={`M${-item.width / 2} 0h${item.width}`}
                    stroke="#0865b1"
                    strokeWidth="45"
                  />
                  <path
                    d={`M${-item.width / 2} -20h${item.width}`}
                    stroke="white"
                    strokeWidth="8"
                  />
                </>
              ) : item.kind === "door" ? (
                <>
                  <path
                    d={`M${-item.width / 2} 0h${item.width}`}
                    stroke="#ead7b6"
                    strokeWidth="45"
                  />
                  <path
                    d={`M${-item.width / 2} 0v${item.width}M${-item.width / 2} ${item.width}A${item.width} ${item.width} 0 0 0 ${item.width / 2} 0`}
                    fill="none"
                    stroke="#6b7b89"
                    strokeWidth="8"
                  />
                </>
              ) : item.kind === "column" ? (
                <rect
                  x={-item.width / 2}
                  y={-item.depth / 2}
                  width={item.width}
                  height={item.depth}
                  fill="#9ca8ae"
                />
              ) : (
                <circle
                  r="65"
                  fill={
                    item.kind === "power"
                      ? "#bd7b00"
                      : item.kind === "vent"
                        ? "#727974"
                        : "#0865b1"
                  }
                />
              )}
            </g>
          );
        })}
      {cabinets.map((cabinet) => {
        const { front } = cabinetAxes(cabinet.position.rotation);
        return (
          <g
            key={cabinet.id}
            data-piece-id={cabinet.id}
            className={`km-plan-cabinet ${cabinet.type === "wall" ? "is-wall" : ""} ${errors.has(cabinet.id) ? "is-invalid" : ""} ${selectedId === cabinet.id ? "is-selected" : ""}`}
          >
            <polygon
              points={cabinetCorners(cabinet)
                .map((p) => `${p.x},${p.z}`)
                .join(" ")}
              role={readOnly ? undefined : "button"}
              tabIndex={readOnly ? undefined : 0}
              aria-label={`${cabinetLabel(cabinet)}, ${cabinet.width / unitScale} ${unit}`}
              aria-pressed={readOnly ? undefined : selectedId === cabinet.id}
              onClick={readOnly ? undefined : () => onSelect(cabinet.id)}
              onPointerDown={readOnly || !onMove ? undefined : event => {
                if (event.button !== 0) return;
                const p = point(event);
                if (!p) return;
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                drag.current = { id: cabinet.id, pointerId: event.pointerId, x: p.x, z: p.y, pose: { ...cabinet.position } };
                onSelect(cabinet.id); onStart?.(cabinet.id);
              }}
              onKeyDown={readOnly ? undefined : (event) => {
                if (["Enter", " "].includes(event.key)) {
                  event.preventDefault();
                  onSelect(cabinet.id);
                }
              }}
            />
            {(cabinet.opening === "sink" || cabinet.opening === "hob") && (
              <g
                transform={`translate(${cabinet.position.x} ${cabinet.position.z}) rotate(${cabinet.position.rotation})`}
                pointerEvents="none"
                fill="none"
                stroke={selectedId === cabinet.id ? "#0051d5" : "#727974"}
                strokeWidth="8"
              >
                {cabinet.opening === "sink" ? (
                  <>
                    <rect
                      x={-cabinet.width * 0.3}
                      y={-cabinet.depth * 0.3}
                      width={cabinet.width * 0.6}
                      height={cabinet.depth * 0.42}
                      rx="25"
                    />
                    <circle cx="0" cy={-cabinet.depth * 0.09} r="32" />
                  </>
                ) : (
                  <>
                    {[-1, 1].flatMap((x) =>
                      [-1, 1].map((y) => (
                        <circle
                          key={`${x}-${y}`}
                          cx={x * cabinet.width * 0.18}
                          cy={y * cabinet.depth * 0.15 - 40}
                          r={cabinet.width * 0.1}
                        />
                      )),
                    )}
                  </>
                )}
              </g>
            )}
            <line
              x1={cabinet.position.x}
              y1={cabinet.position.z}
              x2={cabinet.position.x + front.x * cabinet.depth * 0.4}
              y2={cabinet.position.z + front.z * cabinet.depth * 0.4}
              pointerEvents="none"
            />
            <text
              x={
                cabinet.position.x +
                front.x *
                  cabinet.depth *
                  (cabinet.type === "wall" ? -0.2 : 0.28)
              }
              y={
                cabinet.position.z +
                front.z *
                  cabinet.depth *
                  (cabinet.type === "wall" ? -0.2 : 0.28)
              }
              textAnchor="middle"
              dominantBaseline="middle"
              pointerEvents="none"
              fontSize={80}
            >
              {cabinet.width / unitScale} × {cabinet.depth / unitScale}
            </text>
          </g>
        );
      })}
      {(kitchen.extras ?? []).map(extra=><g key={extra.id} data-piece-id={extra.id} className={`km-plan-cabinet ${selectedId===extra.id ? "is-selected" : ""}`}>
        <polygon points={cabinetCorners(extra).map(p=>`${p.x},${p.z}`).join(" ")} role={readOnly ? undefined : "button"} tabIndex={readOnly ? undefined : 0}
          aria-label={`${extra.name}, ${extra.width / unitScale} ${unit}`} aria-pressed={readOnly ? undefined : selectedId===extra.id} onClick={readOnly ? undefined : ()=>onSelect(extra.id)}
          onPointerDown={readOnly || !onMove ? undefined : event => {
            if (event.button !== 0) return;
            const p = point(event);
            if (!p) return;
            event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { id: extra.id, pointerId: event.pointerId, x: p.x, z: p.y, pose: { ...extra.position } };
            onSelect(extra.id); onStart?.(extra.id);
          }}
          onKeyDown={readOnly ? undefined : e=>{if(["Enter"," "].includes(e.key)){e.preventDefault();onSelect(extra.id);}}}/>
        <text x={extra.position.x} y={extra.position.z} textAnchor="middle" fontSize={70} pointerEvents="none">{extra.width / unitScale} × {extra.depth / unitScale}</text>
      </g>)}
      {showMeasurements && selected && (layer === "all" || cabinets.some(cabinet => cabinet.id === selectedId) || kitchen.extras?.some(extra => extra.id === selectedId)) && <g aria-label="Сонгосон тавилгын хэмжээс ба хананаас зай">
        {dimension(minX, maxZ + 90, maxX, maxZ + 90, format(maxX-minX))}
        {dimension(maxX + 90, minZ, maxX + 90, maxZ, format(maxZ-minZ))}
        {dimension(0, (minZ+maxZ)/2, minX, (minZ+maxZ)/2, format(minX))}
        {dimension(maxX, (minZ+maxZ)/2, kitchen.room.width, (minZ+maxZ)/2, format(kitchen.room.width-maxX))}
        {dimension((minX+maxX)/2, 0, (minX+maxX)/2, minZ, format(minZ))}
        {dimension((minX+maxX)/2, maxZ, (minX+maxX)/2, kitchen.room.depth, format(kitchen.room.depth-maxZ))}
      </g>}
    </svg>
  );
}
