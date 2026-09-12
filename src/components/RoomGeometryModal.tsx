"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { RoomShape } from "@/lib/types";
import { RoomGeometryEditor } from "./RoomGeometryEditor";

export function RoomGeometryModal({ room, onApply, onClose, beginEdit, endEdit }: {
  room: RoomShape;
  onApply: (shape: RoomShape) => string | null;
  onClose: () => void;
  beginEdit: () => void;
  endEdit: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // One editing session is one undo step. The native dialog traps focus
    // and makes the planner behind it inert, including in expanded mode.
    beginEdit();
    dialog.showModal();
    return () => {
      dialog.close();
      endEdit();
      document.body.style.overflow = overflow;
    };
  }, [beginEdit, endEdit]);

  return <dialog ref={dialogRef} className="room-geometry-modal" aria-labelledby="room-geometry-title"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => event.stopPropagation()}>
    <header className="room-geometry-modal-header">
      <h2 id="room-geometry-title" tabIndex={-1} autoFocus>Өрөөний бодит хэмжээ, хэлбэр</h2>
      <button type="button" aria-label="Хэмжээ, хэлбэрийн цонхыг хаах" onClick={onClose}><X size={20} /></button>
    </header>
    <div className="room-geometry-modal-body">
      <RoomGeometryEditor room={room} onApply={onApply} onDone={onClose} />
    </div>
  </dialog>;
}
