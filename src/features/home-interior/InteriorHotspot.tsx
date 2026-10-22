"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, Plus } from "lucide-react";

export function InteriorHotspot({ title, detail, href, linkLabel = "Дэлгэрэнгүй үзэх" }: {
  title: string; detail: string; href: string; linkLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  return <div ref={root} className="interior-hotspot" data-open={open}
    onPointerEnter={event => { if (event.pointerType === "mouse") setOpen(true); }}
    onPointerLeave={event => { if (event.pointerType === "mouse") setOpen(false); }}
    onPointerMove={event => event.stopPropagation()}
    onFocusCapture={() => setOpen(true)}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); setOpen(false); } }}>
    <button type="button" className="interior-hotspot-trigger" aria-label={`${title} · ${detail}`}
      aria-expanded={open} aria-controls={id} onClick={() => setOpen(true)}>
      <Plus size={16} aria-hidden="true" />
    </button>
    <div className="interior-hotspot-card" id={id} hidden={!open}>
      <strong>{title}</strong><span>{detail}</span>
      <a href={href}>{linkLabel}<ArrowUpRight size={14} aria-hidden="true" /></a>
    </div>
  </div>;
}
