"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Info } from "lucide-react";
import type { ModularKitchen } from "@/lib/kitchenCabinets";
import { planKitchenServices } from "@/lib/kitchenServices";
import { SERVICE_COLORS } from "@/three/KitchenServicePoints";
import "./kitchen-services.css";

const LEGEND = [
  { label: "Залгуур", color: SERVICE_COLORS.socket },
  { label: "Плитаны 32А", color: SERVICE_COLORS["cooker-outlet"] },
  { label: "Хүйтэн ус", color: SERVICE_COLORS["water-cold"] },
  { label: "Халуун ус", color: SERVICE_COLORS["water-hot"] },
  { label: "Бохир ус", color: SERVICE_COLORS.drain },
];

/** What the x-ray view shows, and what the electrician and plumber need to know. */
export function KitchenServicesLegend({ kitchen }: { kitchen: ModularKitchen }) {
  const plan = useMemo(() => planKitchenServices(kitchen), [kitchen]);
  const [open, setOpen] = useState(false);
  const warnings = plan.notes.filter(note => note.severity === "warning").length;
  const sockets = plan.points.filter(p => p.kind === "socket" || p.kind === "socket-double");
  const outlets = sockets.reduce((sum, p) => sum + (p.kind === "socket-double" ? 2 : 1), 0);
  const hidden = plan.points.filter(p => p.hidden).length;
  return (
    <section className="kitchen-services-legend" aria-label="Ус, цахилгаан, агааржуулалт">
      <button type="button" className="ksl-head" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        <span>
          <strong>Холболтын цэг</strong>
          <small>{outlets} залгуур тавцан дээр · {hidden} шүүгээний цаана</small>
        </span>
        {warnings > 0 && <em><AlertTriangle size={13} aria-hidden="true" />{warnings}</em>}
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <ul className="ksl-keys">
        {LEGEND.map(item => <li key={item.label}><i style={{ background: item.color }} />{item.label}</li>)}
        {plan.ducts.length > 0 && <li><i className="is-duct" />Сорогчийн хоолой</li>}
      </ul>
      {open && (
        <ul className="ksl-notes">
          {plan.notes.map((note, index) => (
            <li key={index} className={note.severity === "warning" ? "is-warning" : ""}>
              {note.severity === "warning" ? <AlertTriangle size={14} aria-hidden="true" /> : <Info size={14} aria-hidden="true" />}
              <span>{note.message}</span>
            </li>
          ))}
          {!plan.notes.length && <li><Info size={14} aria-hidden="true" /><span>Холболтууд зөв байрлалтай байна.</span></li>}
        </ul>
      )}
    </section>
  );
}
