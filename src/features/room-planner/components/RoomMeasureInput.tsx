"use client";
import { useState } from "react";

/** Keep partially typed measurements local; commit only complete values. */
export function RoomMeasureInput({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "см",
  onChange,
  beginEdit,
  endEdit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  beginEdit: () => void;
  endEdit: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className="room-dimension-field">
      <span>{label}</span>
      <span>
        <input
          aria-label={label}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={draft ?? Number(value.toFixed(2))}
          onFocus={beginEdit}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          onBlur={() => {
            if (
              draft !== null &&
              draft.trim() &&
              Number.isFinite(Number(draft))
            )
              onChange(Number(draft));
            setDraft(null);
            endEdit();
          }}
        />
        <small>{unit}</small>
      </span>
    </label>
  );
}

