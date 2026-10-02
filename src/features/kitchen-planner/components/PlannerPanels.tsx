"use client";
import "./kitchen-plan.css";
import { cabinetAxes, cabinetCorners, placementIssues } from "@/lib/kitchenPlacement";
import { cabinetLabel, type ModularKitchen } from "@/lib/kitchenCabinets";

export function DimensionInput({
  label,
  value,
  min,
  max,
  onCommit,
  disabled = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onCommit: (value: number) => void;
}) {
  return (
    <label className="kp-field">
      <span>{label}</span>
      <span className="kp-number">
        <input
          key={value}
          type="number"
          defaultValue={value}
          min={min}
          max={max}
          step={0.001}
          disabled={disabled}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          onBlur={(event) => {
            const next = event.currentTarget.valueAsNumber;
            if (Number.isFinite(next) && next >= min && next <= max)
              onCommit(next);
            event.currentTarget.value = String(value);
          }}
        />
        <span>мм</span>
      </span>
      <small>
        {min}–{max} мм
      </small>
    </label>
  );
}
export function Plan({
  kitchen,
  selectedId,
  onSelect,
  readOnly = false,
}: {
  kitchen: ModularKitchen;
  selectedId: string | null;
  onSelect: (id: string) => void;
  readOnly?: boolean;
}) {
  const errors = new Set(
    placementIssues(kitchen)
      .filter((issue) => issue.severity === "error")
      .flatMap((issue) => issue.ids),
  );
  const cabinets = [...kitchen.cabinets].sort(
    (a, b) => Number(a.type === "wall") - Number(b.type === "wall"),
  );
  return (
    <svg
      className={`km-plan${readOnly ? " is-read-only" : ""}`}
      viewBox={`-200 -200 ${kitchen.room.width + 450} ${kitchen.room.depth + 400}`}
      role="group"
      aria-label="Модуль шүүгээний дээрээс харах зураг"
    >
      <rect
        x={0}
        y={0}
        width={kitchen.room.width}
        height={kitchen.room.depth}
        className="km-room-outline"
      />
      <text x={kitchen.room.width/2} y={-60} textAnchor="middle" fontSize={70}>{kitchen.room.width} мм</text>
      <text x={kitchen.room.width+80} y={kitchen.room.depth/2} textAnchor="middle" fontSize={70}
        transform={`rotate(90 ${kitchen.room.width+80} ${kitchen.room.depth/2})`}>{kitchen.room.depth} мм</text>
      {cabinets.map((cabinet) => {
        const { front } = cabinetAxes(cabinet.position.rotation);
        return (
          <g
            key={cabinet.id}
            className={`km-plan-cabinet ${cabinet.type === "wall" ? "is-wall" : ""} ${errors.has(cabinet.id) ? "is-invalid" : ""} ${selectedId === cabinet.id ? "is-selected" : ""}`}
          >
            <polygon
              points={cabinetCorners(cabinet)
                .map((p) => `${p.x},${p.z}`)
                .join(" ")}
              role={readOnly ? undefined : "button"}
              tabIndex={readOnly ? undefined : 0}
              aria-label={`${cabinetLabel(cabinet)}, ${cabinet.width} мм`}
              aria-pressed={readOnly ? undefined : selectedId === cabinet.id}
              onClick={readOnly ? undefined : () => onSelect(cabinet.id)}
              onKeyDown={readOnly ? undefined : (event) => {
                if (["Enter", " "].includes(event.key)) {
                  event.preventDefault();
                  onSelect(cabinet.id);
                }
              }}
            />
            <line
              x1={cabinet.position.x}
              y1={cabinet.position.z}
              x2={cabinet.position.x + front.x * cabinet.depth * 0.4}
              y2={cabinet.position.z + front.z * cabinet.depth * 0.4}
              pointerEvents="none"
            />
            <text
              x={cabinet.position.x}
              y={cabinet.position.z}
              textAnchor="middle"
              dominantBaseline="middle"
              pointerEvents="none"
              fontSize={80}
            >
              {cabinet.width}
            </text>
          </g>
        );
      })}
      {(kitchen.extras ?? []).map(extra=><g key={extra.id} className={`km-plan-cabinet ${selectedId===extra.id ? "is-selected" : ""}`}>
        <polygon points={cabinetCorners(extra).map(p=>`${p.x},${p.z}`).join(" ")} role={readOnly ? undefined : "button"} tabIndex={readOnly ? undefined : 0}
          aria-label={`${extra.name}, ${extra.width} мм`} aria-pressed={readOnly ? undefined : selectedId===extra.id} onClick={readOnly ? undefined : ()=>onSelect(extra.id)}
          onKeyDown={readOnly ? undefined : e=>{if(["Enter"," "].includes(e.key)){e.preventDefault();onSelect(extra.id);}}}/>
        <text x={extra.position.x} y={extra.position.z} textAnchor="middle" fontSize={70} pointerEvents="none">{extra.width}</text>
      </g>)}
    </svg>
  );
}
