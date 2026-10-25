"use client";

import { useEffect, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import type { ModularCabinet } from "@/lib/kitchenCabinets";
import type { KitchenMaterialDefinition } from "@/lib/kitchenMaterials";
import { kitchenPaintMaterial, resolveKitchenPaintMaterial } from "@/lib/kitchenPaint";
import { KITCHEN_MATERIAL_GROUPS, kitchenMaterialGroup, type KitchenMaterialGroup } from "@/lib/kitchenMaterialGroups";

export type CabinetAppearancePatch = Partial<Pick<ModularCabinet, "frontMaterialId" | "carcassMaterialId">>;
const colors = [
  ["Цагаан", "#F5F4F0"], ["Шаргал", "#D8C6A8"], ["Саарал", "#9C9D99"], ["Хар саарал", "#343B3B"],
  ["Ногоон", "#647967"], ["Хөх", "#40576C"], ["Бор", "#967451"], ["Хар", "#242424"],
] as const;

export function SurfaceAppearance({ label, side, id, materials, disabled, onChange }: {
  label: string;
  side: "front" | "carcass" | "countertop";
  id?: string;
  materials: KitchenMaterialDefinition[];
  disabled: boolean;
  onChange: (id: string | undefined) => string | void;
}) {
  const selected = resolveKitchenPaintMaterial(id, Object.fromEntries(materials.map(m => [m.id, m])));
  const initialColor = selected?.baseColor ?? "#F5F4F0";
  const [color, setColor] = useState(initialColor);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<KitchenMaterialGroup>("all");
  const [error, setError] = useState<string>();
  useEffect(() => setColor(initialColor), [initialColor, id]);
  const paint = kitchenPaintMaterial(color);
  const options = materials.filter(m => m.surfaceKind === "general" || m.surfaceKind === side);
  const matching = options.filter(m => (group === "all" || kitchenMaterialGroup(m) === group) && m.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  function apply(materialId: string | undefined) {
    setError(onChange(materialId) || undefined);
  }
  function changeColor(value: string) {
    setColor(value);
    const next = kitchenPaintMaterial(value);
    if (next && next.id !== id) apply(next.id);
  }
  return <section className="ksp-surface" aria-label={`${label} өнгө ба материал`}>
    <div className="ksp-surface-heading"><h3>{label}</h3><button type="button" disabled={disabled || !id} onClick={() => apply(undefined)} aria-label={`${label}: эх материалд буцаах`}><RotateCcw size={13} />Эх материал</button></div>
    <p className="ksp-surface-current">{selected?.name ?? "Загварын эх материал"}</p>
    {error && <p className="ksp-note" role="alert">{error}</p>}
    {options.length > 0 && <details className="ksp-material-library" open>
      <summary aria-label={`${label}: материалын сан`}>Материалын сан <span>{options.length}</span></summary>
      <div className="ksp-material-groups" role="group" aria-label={`${label}: материалын бүлэг`}>
        {KITCHEN_MATERIAL_GROUPS.filter(([key]) => key === "all" || options.some(m => kitchenMaterialGroup(m) === key)).map(([key, name]) =>
          <button key={key} type="button" aria-pressed={group === key} onClick={() => { setGroup(key); setQuery(""); }}>{name}</button>)}
      </div>
      <input className="ksp-material-search" type="search" aria-label={`${label}: материал хайх`} placeholder="Код, нэрээр хайх · H3303, Oak…" value={query} onChange={event => setQuery(event.target.value)} />
      <div className="ksp-material-options">
      {matching.map(material => <button key={material.id} type="button" disabled={disabled} aria-pressed={id === material.id}
        onClick={() => apply(material.id)} aria-label={`${label}: ${material.name}`}>
        <span className="ksp-material-swatch" style={{ backgroundColor: material.baseColor, backgroundImage: material.texturePaths.baseColor ? `url("${material.texturePaths.baseColor}")` : undefined }} />
        <span>{material.name}</span>{id === material.id && <Check size={14} />}
      </button>)}
      {!matching.length && <p className="ksp-note">Тохирох материал олдсонгүй.</p>}
    </div></details>}
    <h4>Дан өнгө</h4>
    <div className="ksp-paint-swatches" role="group" aria-label={`${label} бэлэн өнгө`}>
      {colors.map(([name, hex]) => <button key={hex} type="button" title={name} aria-label={`${label}: ${name}`}
        disabled={disabled} aria-pressed={id === kitchenPaintMaterial(hex)?.id} style={{ backgroundColor: hex }}
        onClick={() => apply(kitchenPaintMaterial(hex)!.id)}>{id === kitchenPaintMaterial(hex)?.id && <Check size={15} />}</button>)}
    </div>
    <form className="ksp-paint-custom" onSubmit={event => { event.preventDefault(); if (paint) apply(paint.id); }}>
      <input type="color" aria-label={`${label}: өнгө сонгох`} value={paint?.baseColor ?? initialColor} disabled={disabled} onChange={event => changeColor(event.target.value)} />
      <input type="text" aria-label={`${label}: HEX өнгө`} placeholder="#RRGGBB" maxLength={7} value={color} disabled={disabled} onChange={event => changeColor(event.target.value)} />
      <button type="submit" disabled={disabled || !paint || paint.id === id}>Хэрэглэх</button>
    </form>

  </section>;
}

export function KitchenCabinetAppearance({ cabinet, materials = [], disabled = false, onChange, onEditCountertop }: {
  cabinet: ModularCabinet;
  materials?: KitchenMaterialDefinition[];
  disabled?: boolean;
  onChange: (patch: CabinetAppearancePatch) => string | void;
  onEditCountertop: () => void;
}) {
  const [surface, setSurface] = useState<"front" | "carcass">("front");
  return <div className="ksp-appearance">
    <div className="ksp-surface-switch" role="group" aria-label="Материал солих хэсэг">
      <button type="button" aria-pressed={surface === "front"} onClick={() => setSurface("front")}>Фасад / Хаалга</button>
      <button type="button" aria-pressed={surface === "carcass"} onClick={() => setSurface("carcass")}>Их бие</button>
      <button type="button" disabled={disabled} onClick={() => onEditCountertop()}>Тавцан</button>
    </div>
    <p className="ksp-note">{surface === "front" ? "Хаалганы нүүрэнд" : "Боксын их биед"} оруулах хээг доороос дарж сонгоорой. Сонголт шууд хэрэгжинэ.</p>
    <SurfaceAppearance key={`${cabinet.id}-${surface}`} label={surface === "front" ? "Фасад / Хаалга" : "Их бие"} side={surface}
      id={surface === "front" ? cabinet.frontMaterialId : cabinet.carcassMaterialId} materials={materials} disabled={disabled}
      onChange={id => onChange(surface === "front" ? { frontMaterialId: id } : { carcassMaterialId: id })} />
    <button type="button" className="ksp-reset-appearance" disabled={disabled || (!cabinet.frontMaterialId && !cabinet.carcassMaterialId)}
      onClick={() => onChange({ frontMaterialId: undefined, carcassMaterialId: undefined })}><RotateCcw size={14} />Боксын эх материалд буцаах</button>
    <a className="ksp-supplier-link" href="/materials/b2b-f/index.html" target="_blank" rel="noopener noreferrer">Эх зургуудыг үзэх / татах ↗</a>
  </div>;
}
