"use client";

import { useEffect, useId, useRef, useState } from "react";
import { HelpCircle, X } from "lucide-react";
import type { PlacementWarning, PlacementWarningItem } from "@/lib/roomPlacementWarnings";
import "./room-placement-help.css";

export function RoomPlacementHelp({ warnings, onSelect, onHelp }: {
  warnings: PlacementWarning[];
  onSelect: (item: PlacementWarningItem) => void;
  onHelp: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const dismiss = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      } else if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", dismiss, true);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", dismiss, true);
    };
  }, [open]);
  return <div className="room-placement-help" ref={root} onBlur={event => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
  }}>
    <button ref={trigger} type="button" className="room-help-button"
      aria-label={`Байрлуулалтын сануулга, тусламж${warnings.length ? ` · ${warnings.length} давхцал` : ""}`}
      aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
      title="Байрлуулалтын сануулга, тусламж" onClick={() => setOpen(value => !value)}>
      <HelpCircle size={20} />
      {warnings.length > 0 && <span className="room-warning-count" aria-hidden="true">{warnings.length > 99 ? "99+" : warnings.length}</span>}
    </button>
    {open && <div ref={panel} id={id} tabIndex={-1} className="room-placement-popup" role="dialog" aria-labelledby={`${id}-title`}>
      <div className="room-placement-popup-heading"><strong id={`${id}-title`}>Байрлуулалтын сануулга</strong><button type="button" aria-label="Сануулга хаах" onClick={() => { setOpen(false); trigger.current?.focus(); }}><X size={18}/></button></div>
      <p>Тавилга хоорондоо давхцаж болно. Хана, багана болон таазнаас халих байрлалыг зөвшөөрөхгүй.</p>
      {warnings.length ? <>
        <p role="status">{warnings.length} хос тавилгын эзлэх зай давхцаж байна. Энэ нь хадгалахад саад болохгүй.</p>
        <ul>{warnings.map(warning => <li key={warning.id}>
          <strong>{warning.items[0].name} · {warning.items[1].name}</strong>
          {warning.items.map((item, index) => <button key={item.id} type="button" onClick={() => { setOpen(false); onSelect(item); }}>
            {index + 1}. {item.name} — {item.roomName} · Харах
          </button>)}
        </li>)}</ul>
        <small>Сануулгыг тавилгын хэмжээ, байрлалаар тооцно. Хивс дээрх буйдан зэрэг зориудын давхцал байж болно.</small>
      </> : <p role="status">Тавилгуудын хооронд давхцал илрээгүй.</p>}
      <div className="room-navigation-instructions">
        <strong>3D харагдацын удирдлага</strong>
        <p className="room-mouse-instructions">Тавилгаа зүүн товчоор чирнэ. Харах өнцгийг дунд товчоор эргүүлнэ. Баруун товч эсвэл Shift + дунд товчоор шилжүүлнэ. Дугуйгаар ойртуулна.</p>
        <p className="room-touch-instructions">Тавилгаа нэг хуруугаар чирнэ. Хоосон зайг нэг хуруугаар чирж эргүүлнэ. Хоёр хуруугаар хавчиж ойртуулах, зэрэг чирж харагдацыг шилжүүлэх боломжтой.</p>
        <small>Камер түгжээтэй бол доод удирдлагын дээрх «Тайлах» товчийг дарна уу. +, − болон харах өнцгийн товчнуудыг мөн ашиглаж болно.</small>
      </div>
      <button type="button" className="room-placement-guide" onClick={() => { setOpen(false); onHelp(); }}>Төлөвлөгч ашиглах заавар</button>
    </div>}
  </div>;
}
