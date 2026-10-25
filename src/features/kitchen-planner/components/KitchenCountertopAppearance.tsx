"use client";

import { useState } from "react";
import { ArrowLeft, Move, X } from "lucide-react";
import type { Countertop, ModularKitchen } from "@/lib/kitchenCabinets";
import type { KitchenMaterialDefinition } from "@/lib/kitchenMaterials";
import { SurfaceAppearance } from "./KitchenCabinetAppearance";
import { fitCountertops } from "@/lib/kitchenPlacement";
import { KITCHEN_WALL_MATERIALS } from "@/lib/kitchenWallMaterials";

function Field({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (value: number) => void }) {
  return <label className="ksp-position-field"><span>{label}</span><span className="ksp-input-unit">
    <input key={value} type="number" aria-label={`${label} мм`} defaultValue={value} step={1} disabled={disabled}
      onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }}
      onBlur={event => { const next = event.currentTarget.valueAsNumber; if (Number.isFinite(next) && next !== value) onChange(next); }} /><span>мм</span>
  </span></label>;
}

export function KitchenCountertopAppearance({ kitchen, selectedId, materials, disabled, onChange, onBack, onClose, onSelect, onUpdate, onLayout, onMove, onWall }: {
  kitchen: ModularKitchen;
  selectedId: string | null;
  materials: KitchenMaterialDefinition[];
  disabled: boolean;
  onChange: (id: string | undefined) => string | void;
  onBack: () => void;
  onClose: () => void;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Pick<Countertop, "position" | "width" | "depth" | "thickness">>) => void;
  onLayout: (manual: boolean) => void;
  onMove: () => void;
  onWall: (enabled: boolean, materialId?: string) => string | void;
}) {
  const [section, setSection] = useState<"top" | "wall">("top");
  const tops = fitCountertops(kitchen);
  const top = tops.find(item => item.id === selectedId) ?? tops[0];
  return <section className="kitchen-selection-panel" data-view="countertop" aria-label="Тавцан ба ханын өнгөлгөө">
    <header className="ksp-header">
      <button type="button" className="ksp-icon-button" aria-label="Боксын материал руу буцах" onClick={onBack}><ArrowLeft size={17} /></button>
      <h2>Тавцан / Хана</h2>
      <button type="button" className="ksp-icon-button" aria-label="Тавцангийн тохиргоог хаах" onClick={onClose}><X size={17} /></button>
    </header>
    <div className="ksp-scroll"><div className="ksp-appearance">
      <div className="ksp-surface-switch" role="group" aria-label="Тавцан эсвэл хана сонгох">
        <button type="button" aria-pressed={section === "top"} onClick={() => setSection("top")}>Тавцан</button>
        <button type="button" aria-pressed={section === "wall"} onClick={() => setSection("wall")}>Ханын өнгөлгөө</button>
      </div>
      {section === "top" ? <>
        <p className="ksp-note">Тавцанг тусдаа салгаж зөөх эсвэл доод шүүгээнд автоматаар тааруулж болно.</p>
        <div className="ksp-surface-switch" role="group" aria-label="Тавцангийн байрлуулах горим">
          <button type="button" disabled={disabled} aria-pressed={!kitchen.countertopLayout} onClick={() => onLayout(false)}>Бокст тааруулах</button>
          <button type="button" disabled={disabled} aria-pressed={Boolean(kitchen.countertopLayout)} onClick={() => onLayout(true)}>Тусдаа зөөх</button>
        </div>
        {top && <>
          <label className="ksp-top-picker">Тавцан сонгох<select aria-label="Тавцан сонгох" value={top.id} disabled={disabled} onChange={event => onSelect(event.target.value)}>
            {tops.map((item, index) => <option key={item.id} value={item.id}>Тавцан {index + 1} · {item.width} × {item.depth} мм</option>)}
          </select></label>
          <button type="button" className="ksp-primary" disabled={disabled} onClick={onMove}><Move size={16} />Тавцанг зураг дээр зөөх</button>
          <p className="ksp-note">Тавцан дээр дарж чирнэ. Esc дарвал өмнөх байрлалд буцна.</p>
          <div className="ksp-top-fields">
            <Field label="Тавцангийн өргөн" value={top.width} disabled={disabled} onChange={width => onUpdate(top.id, { width })} />
            <Field label="Тавцангийн гүн" value={top.depth} disabled={disabled} onChange={depth => onUpdate(top.id, { depth })} />
            <Field label="Тавцан зүүнээс" value={top.position.x} disabled={disabled} onChange={x => onUpdate(top.id, { position: { ...top.position, x } })} />
            <Field label="Тавцан хойноос" value={top.position.z} disabled={disabled} onChange={z => onUpdate(top.id, { position: { ...top.position, z } })} />
            <Field label="Тавцан шалнаас" value={top.position.y} disabled={disabled} onChange={y => onUpdate(top.id, { position: { ...top.position, y } })} />
          </div>
        </>}
        {!top && <p className="ksp-note">Доод шүүгээ нэмэхэд тавцан үүснэ.</p>}
        <p className="ksp-note">Материалын сонголт бүх тавцанд хэрэгжинэ. Ханын өнгөлгөө тусдаа.</p>
        <SurfaceAppearance label="Тавцан" side="countertop" id={kitchen.countertop.materialId ?? kitchen.countertop.finish}
          materials={materials} disabled={disabled} onChange={onChange} />
      </> : <>
        <p className="ksp-note">Хананы будаг, обойг хэвээр үлдээх эсвэл зөвхөн арын хэсэгт плитка, хээ сонгоорой.</p>
        <div className="ksp-surface-switch" role="group" aria-label="Ханын өнгөлгөөний төрөл">
          <button type="button" disabled={disabled} aria-pressed={!kitchen.backsplash} onClick={() => onWall(false)}>Хана хэвээр</button>
          <button type="button" disabled={disabled} aria-pressed={Boolean(kitchen.backsplash)} onClick={() => onWall(true, kitchen.backsplashMaterialId ?? "wall-tiles-white")}>Плитка / Хээ</button>
        </div>
        {kitchen.backsplash && <SurfaceAppearance label="Ханын өнгөлгөө" side="front" id={kitchen.backsplashMaterialId ?? "wall-tiles-white"}
          materials={[...KITCHEN_WALL_MATERIALS, ...materials]} disabled={disabled} onChange={id => onWall(true, id ?? "wall-tiles-white")} />}
      </>}
    </div></div>
  </section>;
}
