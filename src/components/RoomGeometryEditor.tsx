"use client";

import { useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import type { RoomShape, RoomWall, PlacedFurniture } from "@/lib/types";
import { RoomPlanPreview } from "./RoomPlanPreview";
import { getRoomGeometry, ROOM_WALLS, validateRoomShape } from "@/lib/roomGeometry";

function Millimetres({ label, value, onChange, min = 0, max = 20000 }: {
  label: string; value: number; onChange: (value: number) => void; min?: number; max?: number;
}) {
  return <label className="planner-number"><span>{label} · мм</span>
    <input type="number" inputMode="numeric" min={min} max={max} step={1} required
      value={Number.isFinite(value) ? Math.round(value * 1000) : ""}
      onChange={event => onChange(event.target.value === "" ? NaN : Number(event.target.value) / 1000)} />
  </label>;
}

export function RoomGeometryEditor({ room, onApply, onDone }: {
  room: RoomShape & { pieces?: PlacedFurniture[] }; onApply: (shape: RoomShape) => string | null; onDone: () => void;
}) {
  const [draft, setDraft] = useState<RoomShape>(() => ({ width: room.width, depth: room.depth, height: room.height ?? 2.7,
    wallFeatures: (room.wallFeatures ?? []).map(feature => ({ ...feature })), columns: (room.columns ?? []).map(column => ({ ...column })),
  }));
  const [error, setError] = useState("");
  const problem = validateRoomShape(draft);
  const preview = room;
  const geometry = getRoomGeometry(preview);
  const update = (patch: Partial<RoomShape>, keepOnError = false) => {
    // Apply this event's next value, never the state from the previous render.
    const next = { ...draft, ...patch };
    const issue = validateRoomShape(next) ?? onApply(next);
    if (!issue || !keepOnError) setDraft(next);
    setError(issue ?? "");
  };

  return <form className="planner-room-form room-geometry-editor" onSubmit={event => {
    event.preventDefault();
    if (!problem && !error) onDone();
  }}>
    <p className="room-shape-help">Зөв өөрчлөлт бүр өрөөнд шууд хэрэгжинэ. Алдаатай утга хэрэгжихгүй бөгөөд цонхыг хаахад орхигдоно.</p>
    <div className="planner-fields">
      <Millimetres label="AB · өргөн" value={draft.width} min={1000} onChange={width => update({ width })} />
      <Millimetres label="BC · урт" value={draft.depth} min={1000} onChange={depth => update({ depth })} />
    </div>
    <Millimetres label="Ханын өндөр" value={draft.height ?? 2.7} min={2000} max={5000} onChange={height => update({ height })} />
    <RoomPlanPreview room={preview} pieces={room.pieces} />
    <p className="room-shape-area">Ашиглах талбай: <strong>{geometry.area.toFixed(2)} м²</strong>{(error || problem) ? " · хэрэгжсэн хэлбэр" : ""}</p>
    <details className="room-wall-measurements"><summary>Ханын бүх хэсгийн хэмжээс · {geometry.segments.filter(segment => !segment.hole).length}</summary>
      <ol>{geometry.segments.filter(segment => !segment.hole).map((segment, index) => <li key={index}>
        <span>Х{index + 1}</span><strong>{Math.round(segment.length * 1000)} мм</strong>
      </li>)}</ol><small>Дээрээс харсан хүрээг даган дараалсан хэсгүүд. Баганы хүрээ энд орохгүй.</small>
    </details>

    <h3>Ханын товойлт, хонхорхой</h3>
    <p className="room-shape-help">Эхлэх зайг AB хананд A-гаас, BC-д B-гээс, CD-д C-гээс, DA-д D-гээс хэмжинэ. Булангийн хэсэг бол эхлэх зайг 0 болгоно.</p>
    {(draft.wallFeatures ?? []).map((feature, index) => <fieldset className="room-shape-feature" key={feature.id}>
      <legend>Ханын хэсэг {index + 1}</legend>
      <div className="planner-fields">
        <label className="planner-number"><span>Аль хана</span><select value={feature.wall} onChange={event => update({
          wallFeatures: draft.wallFeatures!.map(item => item.id === feature.id ? { ...item, wall: event.target.value as RoomWall } : item),
        })}>{Object.entries(ROOM_WALLS).map(([wall, label]) => <option key={wall} value={wall}>{label}</option>)}</select></label>
        <label className="planner-number"><span>Хэлбэр</span><select value={feature.kind} onChange={event => update({
          wallFeatures: draft.wallFeatures!.map(item => item.id === feature.id ? { ...item, kind: event.target.value as "inset" | "recess" } : item),
        })}><option value="inset">Дотогш товойлт</option><option value="recess">Гадагш хонхорхой</option></select></label>
      </div>
      <div className="planner-fields">{([
        ["offset", "Эхлэх зай", 0], ["length", "Ханын дагуух урт", 50], ["depth", "Товойх / хонхойх гүн", 50],
      ] as const).map(([key, label, min]) => <Millimetres key={key} label={label} value={feature[key]} min={min} max={key === "depth" ? 3000 : 20000}
        onChange={value => update({ wallFeatures: draft.wallFeatures!.map(item => item.id === feature.id ? { ...item, [key]: value } : item) })} />)}</div>
      <button type="button" className="room-shape-remove" aria-label={`${index + 1}-р ханын хэсгийг хасах`}
        onClick={() => update({ wallFeatures: draft.wallFeatures!.filter(item => item.id !== feature.id) }, true)}><Trash2 size={15} /> Хэсгийг хасах</button>
    </fieldset>)}
    <button type="button" className="room-shape-add" disabled={(draft.wallFeatures?.length ?? 0) >= 24} onClick={() => update({
      wallFeatures: [...(draft.wallFeatures ?? []), { id: crypto.randomUUID(), wall: "north", kind: "inset", offset: 0, length: 0.6, depth: 0.2 }],
    })}><Plus size={16} /> Ханын хэсэг нэмэх</button>

    <h3>Тусдаа багана</h3>
    <p className="room-shape-help">Баганын зүүн арын булан хүртэлх X, Z зайг өрөөний A булангаас хэмжинэ.</p>
    {(draft.columns ?? []).map((column, index) => <fieldset key={column.id} className="room-shape-feature">
      <legend>Багана {index + 1}</legend>
      <div className="planner-fields">{([
        ["x", "X · баруун тийш", 0], ["z", "Z · урагш", 0], ["width", "Өргөн", 50], ["depth", "Гүн", 50],
      ] as const).map(([key, label, min]) => <Millimetres key={key} label={label} value={column[key]} min={min}
        onChange={value => update({ columns: draft.columns!.map(item => item.id === column.id ? { ...item, [key]: value } : item) })} />)}</div>
      <button type="button" className="room-shape-remove" aria-label={`${index + 1}-р баганыг хасах`}
        onClick={() => update({ columns: draft.columns!.filter(item => item.id !== column.id) }, true)}><Trash2 size={15} /> Баганыг хасах</button>
    </fieldset>)}
    <button type="button" className="room-shape-add" disabled={(draft.columns?.length ?? 0) >= 12} onClick={() => update({
      columns: [...(draft.columns ?? []), { id: crypto.randomUUID(), x: 0.5, z: 0.5, width: 0.3, depth: 0.3 }],
    })}><Plus size={16} /> Багана нэмэх</button>
    {(error || problem) && <p className="room-shape-error" role="alert">{error || problem}</p>}
    <button type="submit" className="btn-primary room-shape-apply"><Check size={16} /> Дуусгах</button>
  </form>;
}
