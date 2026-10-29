"use client";
import { useEffect, useRef } from "react";
import { Pencil } from "lucide-react";
import type { KitchenSaveStatus } from "@/lib/kitchenSaveStatus";

export function KitchenProjectName({ name, onName, busy, status }: {
  name: string; onName: (name: string) => void; busy: boolean; status?: KitchenSaveStatus;
}) {
  const menu = useRef<HTMLDetailsElement>(null), input = useRef<HTMLInputElement>(null), original = useRef(name);
  const latest = useRef({ name, onName });
  latest.current = { name, onName };
  useEffect(() => {
    const close = (cancel = false, restoreFocus = false) => {
      if (!menu.current?.open) return;
      const { name, onName } = latest.current;
      onName(cancel ? original.current : name.trim() || original.current || "Миний гал тогоо");
      menu.current.open = false;
      if (restoreFocus) menu.current.querySelector("summary")?.focus();
    };
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node)) close(); };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menu.current?.open) { event.preventDefault(); event.stopPropagation(); close(true, true); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", keyboard, true);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", keyboard, true); };
  }, []);
  return <details ref={menu} className="kitchen-project-menu" onToggle={event => {
    if (event.currentTarget.open) { original.current = name; input.current?.focus(); input.current?.select(); }
    else if (!name.trim()) onName(original.current || "Миний гал тогоо");
  }}>
    <summary title={status?.detail ?? "Төслийн нэр засах"} aria-label={`Төслийн нэр засах: ${name || "Нэргүй төсөл"}`} aria-disabled={busy}
      onClick={event => { if (busy) event.preventDefault(); }}>
      <span className="kitchen-project-visible-name"><strong title={name || undefined}>{name || "Нэргүй төсөл"}</strong>
        {status && <small role="status" data-save-kind={status.kind}>{status.label}</small>}
      </span><Pencil size={14}/>
    </summary>
    <label>Төслийн нэр<input ref={input} value={name} maxLength={100} disabled={busy} onChange={event => onName(event.target.value)}
      onKeyDown={event => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        onName(name.trim() || original.current || "Миний гал тогоо");
        if (menu.current) { menu.current.open = false; menu.current.querySelector("summary")?.focus(); }
      }} />
      <small>Enter: нэрийг батлах · Escape: өмнөх нэрээ сэргээх</small>
      {status && <small>{status.detail}</small>}
    </label>
  </details>;
}
