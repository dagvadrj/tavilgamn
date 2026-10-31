"use client";
import { useEffect, useMemo, useState } from "react";
import type { KitchenRoom, KitchenSpaceItem, ModularKitchen } from "@/lib/kitchenCabinets";
import { resizeKitchenRoom } from "@/lib/kitchenSpace";
import { addRoomOpening } from "@/lib/kitchenOpenings";
import {
  KITCHEN_ROOM_LIMITS,
  KITCHEN_WALLS,
  WALL_THICKNESS_MM,
  fromUnit,
  kitchenRoomIssues,
  openingOffset,
  toUnit,
  wallLength,
  wallLetter,
  type KitchenRoomField,
  type KitchenUnit,
} from "@/lib/kitchenWorkspace";

const FIELDS: { id: KitchenRoomField; label: string; hint: string }[] = [
  { id: "width", label: "Өргөн", hint: "A, C хана" },
  { id: "depth", label: "Гүн", hint: "B, D хана" },
  { id: "height", label: "Таазны өндөр", hint: "Шалнаас тааз" },
];
const UTILITY: Record<string, { icon: string; label: string }> = {
  water: { icon: "У", label: "Ус / бохир" },
  power: { icon: "Ц", label: "Цахилгаан" },
  vent: { icon: "А", label: "Агааржуулалт" },
};
const COLUMN = 400;

/**
 * K1 room panel. A value outside the brief's limits is kept only as a draft
 * here (never saved into the design) and reported up so steps 2–4 lock.
 */
export function KitchenRoomPanel({
  kitchen,
  disabled,
  onChange,
  onIssues,
}: {
  kitchen: ModularKitchen;
  disabled: boolean;
  onChange: (kitchen: ModularKitchen) => boolean;
  /** Number of fields with an invalid draft or a design-level room issue. */
  onIssues: (count: number) => void;
}) {
  const room = kitchen.room;
  const [unit, setUnit] = useState<KitchenUnit>("mm");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const issues = useMemo(() => kitchenRoomIssues(room, unit), [room, unit]);
  const shown: Record<string, string> = { ...issues.fields, ...issues.openings, ...errors };
  const count = Object.keys(shown).length;
  useEffect(() => onIssues(count), [count, onIssues]);

  const setRoom = (next: KitchenRoom) => onChange({ ...kitchen, room: next });
  const commitField = (key: string, text: string, apply: (mm: number) => KitchenRoom, check: (mm: number) => string | undefined) => {
    setDrafts((value) => ({ ...value, [key]: text }));
    const mm = fromUnit(text, unit);
    const problem = mm === null ? "Тоо оруулна уу." : check(mm);
    if (problem) {
      setErrors((value) => ({ ...value, [key]: problem }));
      return;
    }
    try {
      if (!setRoom(apply(mm!))) throw new Error("Өрөөг хадгалж чадсангүй.");
      setErrors(({ [key]: _done, ...rest }) => rest);
      setDrafts(({ [key]: _done, ...rest }) => rest);
    } catch (reason) {
      setErrors((value) => ({ ...value, [key]: (reason as Error).message }));
    }
  };
  const limit = (field: keyof typeof KITCHEN_ROOM_LIMITS, label: string) => (mm: number) => {
    const bounds = KITCHEN_ROOM_LIMITS[field] as readonly [number, number];
    return mm < bounds[0] || mm > bounds[1]
      ? `${label} ${toUnit(bounds[0], unit)}–${toUnit(bounds[1], unit)} ${unit} байна.`
      : undefined;
  };
  const value = (key: string, mm: number) => drafts[key] ?? toUnit(mm, unit);
  const openings = (room.items ?? []).filter((item) => item.kind === "door" || item.kind === "window");
  const missingOpenings = (["window", "door"] as const).filter((kind) => !openings.some((item) => item.kind === kind));
  const [openingError, setOpeningError] = useState("");
  const addOpening = (kind: "window" | "door") => {
    const next = addRoomOpening(kitchen, kind, `${kind}-${Date.now().toString(36)}`);
    setOpeningError(next ? "" : `${kind === "window" ? "Цонх" : "Хаалга"} багтах чөлөөтэй хана алга. 2D төлөвлөгөөн дээрээс байрлуулна уу.`);
    if (next) setRoom(next);
  };
  const utilities = (room.items ?? []).filter((item) => item.kind in UTILITY);
  const column = (room.items ?? []).find((item) => item.kind === "column");
  const moveOpening = (item: KitchenSpaceItem, patch: { width?: number; offset?: number }) => {
    const width = patch.width ?? item.width;
    const offset = patch.offset ?? openingOffset(room, item);
    const centre = offset + width / 2;
    const horizontal = item.wall === "back" || item.wall === "front";
    return {
      ...room,
      items: room.items!.map((other) =>
        other.id === item.id ? { ...other, width, ...(horizontal ? { x: centre } : { z: centre }) } : other,
      ),
    };
  };
  const openingCheck = (item: KitchenSpaceItem, part: "width" | "offset") => (mm: number) => {
    const width = part === "width" ? mm : item.width;
    const offset = part === "offset" ? mm : openingOffset(room, item);
    const size = limit(item.kind as "door" | "window", item.kind === "door" ? "Хаалганы өргөн" : "Цонхны өргөн")(width);
    if (size) return size;
    const room_ = wallLength(room, item.wall) - KITCHEN_ROOM_LIMITS.openingMargin;
    return offset < 0 || offset + width > room_
      ? `Байрлал + өргөн ${toUnit(room_, unit)} ${unit}-ээс хэтэрч байна.`
      : undefined;
  };

  return (
    <div className="kitchen-k-room">
      <div className="kitchen-k-room-head">
        <div>
          <span className="kitchen-k-eyebrow">Алхам 1</span>
          <strong>Өрөөний хэмжээс</strong>
        </div>
        <div className="kitchen-k-segmented" role="group" aria-label="Нэгж">
          {(["mm", "cm"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={unit === option}
              // Switching while a value is wrong would silently re-round it.
              disabled={count > 0 && unit !== option}
              title={count > 0 ? "Алдааг засаад нэгжээ солино" : undefined}
              onClick={() => setUnit(option)}
            >
              {option === "mm" ? "мм" : "см"}
            </button>
          ))}
        </div>
      </div>

      <section aria-label="Хэмжээс">
        {FIELDS.map((field) => {
          const key = field.id;
          const error = shown[key];
          return (
            <div key={key} className="kitchen-k-field">
              <label htmlFor={`k-room-${key}`}>
                {field.label}
                <span>{field.hint}</span>
              </label>
              <div data-invalid={!!error || undefined}>
                <input
                  id={`k-room-${key}`}
                  inputMode="numeric"
                  disabled={disabled}
                  aria-invalid={!!error}
                  aria-describedby={error ? `k-room-${key}-error` : undefined}
                  value={value(key, room[key])}
                  onChange={(event) => setDrafts((drafts) => ({ ...drafts, [key]: event.target.value }))}
                  onBlur={(event) =>
                    commitField(key, event.target.value, (mm) => resizeKitchenRoom(room, { [key]: mm }), limit(key, field.label))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                />
                <span>{unit === "mm" ? "мм" : "см"}</span>
              </div>
              {error && (
                <span id={`k-room-${key}-error`} role="alert" className="kitchen-k-error">
                  {error}
                </span>
              )}
            </div>
          );
        })}
      </section>

      <section aria-label="Ханууд">
        <h3>
          Ханууд <small>· зузаан {WALL_THICKNESS_MM} мм</small>
        </h3>
        <ul className="kitchen-k-walls">
          {KITCHEN_WALLS.map((wall) => (
            <li key={wall.side}>
              <span aria-hidden="true">{wall.letter}</span>
              <strong>{wall.letter} хана</strong>
              <small>{toUnit(wallLength(room, wall.side), unit)} {unit === "mm" ? "мм" : "см"}</small>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Нүх">
        <h3>Нүх (цонх, хаалга)</h3>
        {missingOpenings.length > 0 && (
          <div className="kitchen-k-openings-hint">
            <p>
              {openings.length
                ? `${missingOpenings[0] === "window" ? "Цонх" : "Хаалга"} алга.`
                : "Цонх, хаалгаа нэмбэл нарны гэрэл, шүүгээний байрлал бодитой болно."}
            </p>
            <div>
              {missingOpenings.map((kind) => (
                <button key={kind} type="button" className="kitchen-k-ghost" disabled={disabled} onClick={() => addOpening(kind)}>
                  + {kind === "window" ? "Цонх нэмэх" : "Хаалга нэмэх"}
                </button>
              ))}
            </div>
            {openingError && <span role="alert" className="kitchen-k-error">{openingError}</span>}
          </div>
        )}
        {openings.map((item) =>
          (["width", "offset"] as const).map((part) => {
            const key = `${item.id}:${part}`;
            const error = shown[key] ?? (part === "width" ? shown[item.id] : undefined);
            const label = `${item.kind === "door" ? "Хаалга" : "Цонх"} · ${wallLetter(item.wall)} хана · ${part === "width" ? "өргөн" : "байрлал"}`;
            return (
              <div key={key} className="kitchen-k-field is-row">
                <label htmlFor={`k-room-${key}`}>{label}</label>
                <div data-invalid={!!error || undefined}>
                  <input
                    id={`k-room-${key}`}
                    inputMode="numeric"
                    disabled={disabled}
                    aria-invalid={!!error}
                    value={value(key, part === "width" ? item.width : openingOffset(room, item))}
                    onChange={(event) => setDrafts((drafts) => ({ ...drafts, [key]: event.target.value }))}
                    onBlur={(event) =>
                      commitField(key, event.target.value, (mm) => moveOpening(item, { [part]: mm }), openingCheck(item, part))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                  />
                  <span>{unit === "mm" ? "мм" : "см"}</span>
                </div>
                {error && <span role="alert" className="kitchen-k-error">{error}</span>}
              </div>
            );
          }),
        )}
      </section>

      <section aria-label="Багана">
        <h3>Багана</h3>
        {column ? (
          <div className="kitchen-k-chiprow">
            <span>
              Багана {column.width} × {column.depth} · {wallLetter(column.wall)} хана
            </span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setRoom({ ...room, items: room.items!.filter((item) => item.id !== column.id) })}
            >
              Хасах
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="kitchen-k-ghost"
            disabled={disabled}
            onClick={() =>
              setRoom({
                ...room,
                items: [
                  ...(room.items ?? []),
                  { id: `column-${Date.now().toString(36)}`, kind: "column", wall: "left", x: COLUMN / 2, z: COLUMN / 2, width: COLUMN, depth: COLUMN },
                ],
              })
            }
          >
            + Багана нэмэх
          </button>
        )}
      </section>

      <section aria-label="Утилити">
        <h3>Ус · цахилгаан · агааржуулалт</h3>
        {!utilities.length && <p className="kitchen-k-muted">Тэмдэглээгүй. 2D төлөвлөгөөн дээр «Ус», «Цахилгаан»-аар нэмнэ.</p>}
        <ul className="kitchen-k-utilities">
          {utilities.map((item) => (
            <li key={item.id}>
              <span aria-hidden="true" data-kind={item.kind}>{UTILITY[item.kind].icon}</span>
              <strong>{UTILITY[item.kind].label}</strong>
              <small>
                {wallLetter(item.wall)} хана · {toUnit(item.wall === "back" || item.wall === "front" ? item.x : item.z, unit)} {unit === "mm" ? "мм" : "см"}
                {item.height !== undefined && ` · ${toUnit(item.height, unit)} өндөр`}
              </small>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
