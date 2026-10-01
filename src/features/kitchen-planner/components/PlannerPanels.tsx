"use client";
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
}: {
  kitchen: ModularKitchen;
  selectedId: string | null;
  onSelect: (id: string) => void;
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
      className="km-plan"
      viewBox={`-150 -150 ${kitchen.room.width + 300} ${kitchen.room.depth + 300}`}
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
              role="button"
              tabIndex={0}
              aria-label={`${cabinetLabel(cabinet)}, ${cabinet.width} мм`}
              aria-pressed={selectedId === cabinet.id}
              onClick={() => onSelect(cabinet.id)}
              onKeyDown={(event) => {
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
    </svg>
  );
}
