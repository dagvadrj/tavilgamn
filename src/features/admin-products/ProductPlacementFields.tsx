"use client";
import type { PlacementMetadata } from "@/lib/types";
import { normalizePlacementMetadata } from "@/lib/placementMetadata";

export function ProductPlacementFields({ value, onChange }: { value?: PlacementMetadata; onChange: (value: PlacementMetadata) => void }) {
  const placement = normalizePlacementMetadata(value);
  return <fieldset className="rounded-xl border border-ink/10 p-3 sm:col-span-2">
    <legend className="px-1 text-sm font-medium">Planner-т байрлуулах арга</legend>
    <p className="mb-3 text-xs text-ink/60">Зөвшөөрсөн гадаргууг сонгоно. Зөвхөн ханын тавиур бол “Хананд”-ыг сонгоод “Шалан дээр”-ийг болиулна.</p>
    <div className="grid gap-3 sm:grid-cols-3">
      {([["floor", "Шалан дээр"], ["wall", "Хананд"], ["surface", "Тулгуур дээр"]] as const).map(([surface,label]) => <label key={surface} className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={placement.surfaces.includes(surface)} disabled={placement.surfaces.length === 1 && placement.surfaces[0] === surface} onChange={e => onChange({ ...placement, surfaces: e.target.checked ? [...placement.surfaces, surface] : placement.surfaces.filter(s => s !== surface) })} />{label}
      </label>)}
    </div>
    {placement.surfaces.includes("wall") && <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="text-sm">Доод ирмэгийн өндөр · см<input className="input mt-1" type="number" min="0" max="10000" step="1" value={(placement.defaultElevation ?? 1.4) * 100} onChange={e => onChange({ ...placement, defaultElevation: Number(e.target.value) / 100 })}/></label>
      <label className="text-sm">Ханын завсар · см<input className="input mt-1" type="number" min="0" max="20" step="0.1" value={(placement.gap ?? .01) * 100} onChange={e => onChange({ ...placement, gap: Number(e.target.value) / 100 })}/></label>
    </div>}
  </fieldset>;
}
