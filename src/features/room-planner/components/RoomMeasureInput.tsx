"use client";
import { useState } from "react";
import { useRoomMeasureUnit } from "./RoomMeasureUnit";

/** Keep partially typed measurements local; commit only complete values. */
export function RoomMeasureInput({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  beginEdit,
  endEdit,
  autoFocus = false,
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
  autoFocus?: boolean;
}) {
  const preference = useRoomMeasureUnit(state => state.unit);
  const displayUnit = unit ?? preference;
  const factor = unit === undefined && preference === "мм" ? 10 : 1;
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState("");
  return (
    <label className="room-dimension-field">
      <span>{label}</span>
      <span>
        <input
          autoFocus={autoFocus}
          aria-label={label}
          type="number"
          inputMode="decimal"
          min={min * factor}
          max={max * factor}
          step={step * factor}
          value={draft ?? Number((value * factor).toFixed(2))}
          onFocus={beginEdit}
          aria-invalid={!!error}
          onChange={(event) => { setDraft(event.target.value); setError(""); }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.blur();
            }
          }}
          onBlur={() => {
            if (draft !== null) {
              const next = Number(draft) / factor;
              if (draft.trim() && Number.isFinite(next) && next >= min && next <= max) {
                onChange(next);
                setError("");
              } else setError(`${min * factor}–${Number((max * factor).toFixed(2))} ${displayUnit} утга оруулна уу.`);
            }
            setDraft(null);
            endEdit();
          }}
        />
        <small>{displayUnit}</small>
      </span>
      {error && <small role="alert">{error}</small>}
    </label>
  );
}

