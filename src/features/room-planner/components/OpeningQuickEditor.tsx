"use client";
import type { RoomOpening, RoomShape, RoomWall } from "@/lib/types";
import { getRoomGeometry, ROOM_WALLS } from "@/lib/roomGeometry";
import { wallLength, openingMinimumWidth } from "@/lib/roomOpenings";
import { RoomMeasureInput } from "./RoomMeasureInput";
import { RoomMeasureUnit } from "./RoomMeasureUnit";

export function OpeningEdgeDistance({ room, opening, onChange, beginEdit, endEdit }: {
  room: RoomShape; opening: RoomOpening; onChange: (opening: RoomOpening) => void;
  beginEdit: () => void; endEdit: () => void;
}) {
  const length = wallLength(room, opening.wallId, opening.segmentId);
  const edit = { beginEdit, endEdit };
  const [start, end] = opening.segmentId ? ["Ханын эхний", "Ханын эцсийн"] : { north: ["A", "B"], east: ["B", "C"], south: ["C", "D"], west: ["D", "A"] }[opening.wallId];
  return <div className="room-field-pair">
    <RoomMeasureInput label={`${start} булангаас ойрын ирмэг`} value={(opening.position * length - opening.width / 2) * 100} min={0} max={(length - opening.width) * 100} step={0.1} onChange={v => onChange({ ...opening, position: (v / 100 + opening.width / 2) / length })} {...edit} />
    <RoomMeasureInput label={`${end} булангаас ойрын ирмэг`} value={(length - opening.position * length - opening.width / 2) * 100} min={0} max={(length - opening.width) * 100} step={0.1} onChange={v => onChange({ ...opening, position: (length - v / 100 - opening.width / 2) / length })} {...edit} />
  </div>;
}

export function OpeningQuickEditor({ room, opening, onChange, onRemove, beginEdit, endEdit }: {
  room: RoomShape; opening: RoomOpening; onChange: (opening: RoomOpening) => void;
  onRemove: () => void; beginEdit: () => void; endEdit: () => void;
}) {
  const edit = { beginEdit, endEdit };
  return <section className="room-opening-quick-editor" aria-label="Сонгосон хаалга цонхны засвар" onKeyDown={e => e.stopPropagation()}>
    <header><strong>{opening.kind === "door" ? "Хаалга" : "Цонх"}</strong><RoomMeasureUnit /></header>
    {room.outline ? <label>Байрлах хана<select value={opening.segmentId} onChange={e => onChange({ ...opening, segmentId:e.target.value })}>{getRoomGeometry(room).segments.map((s,i) => <option key={s.id} value={s.id}>Хана {i+1}</option>)}</select></label> : <label>Байрлах хана <select aria-label="Байрлах хана" value={opening.wallId} onChange={e => onChange({ ...opening, wallId: e.target.value as RoomWall })}>{Object.entries(ROOM_WALLS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>}
    <div className="room-field-pair">
      <RoomMeasureInput label="Өргөн" value={opening.width * 100} min={openingMinimumWidth(opening) * 100} max={wallLength(room, opening.wallId, opening.segmentId) * 100} onChange={v => onChange({ ...opening, width: v / 100 })} {...edit} />
      <RoomMeasureInput label="Өндөр" value={opening.height * 100} min={30} max={((room.height ?? 2.7) - opening.sillHeight) * 100} onChange={v => onChange({ ...opening, height: v / 100 })} {...edit} />
    </div>
    <OpeningEdgeDistance room={room} opening={opening} onChange={onChange} {...edit} />
    {opening.kind === "door" ? <div className="room-field-pair">
      <label>Нугас <select aria-label="Нугас" value={opening.hinge} onChange={e => onChange({ ...opening, hinge: e.target.value as "left" | "right" })}><option value="left">Зүүн</option><option value="right">Баруун</option></select></label>
      <label>Нээгдэх чиглэл <select aria-label="Нээгдэх чиглэл" value={opening.swing} onChange={e => onChange({ ...opening, swing: e.target.value as "inward" | "outward" })}><option value="inward">Дотогш</option><option value="outward">Гадагш</option></select></label>
    </div> : <RoomMeasureInput label="Шалнаас тавцан хүртэл" value={opening.sillHeight * 100} min={0} max={((room.height ?? 2.7) - opening.height) * 100} onChange={v => onChange({ ...opening, sillHeight: v / 100 })} {...edit} />}
    <button type="button" onClick={onRemove}>Устгах</button>
  </section>;
}
