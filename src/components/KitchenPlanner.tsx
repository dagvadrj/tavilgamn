"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Plus, Ruler, Trash2 } from "lucide-react";
import {
  CABINET_TYPES, DIMENSIONS, FINISHES, createKitchen, fitCabinets, kitchenHeight, usedWidth, validateKitchen,
  type Cabinet, type CabinetKind, type DimensionKey, type Finish, type FrontStyle, type HandleStyle, type Kitchen,
} from "@/lib/kitchen";
import "./kitchen-planner.css";

const KitchenViewer = dynamic(() => import("@/three/KitchenViewer").then(module => module.KitchenViewer), {
  ssr: false,
  loading: () => <p className="kp-viewer-message" role="status">3D загварыг бэлдэж байна…</p>,
});

function NumberField({ label, value, min, max, onCommit }: {
  label: string; value: number; min: number; max: number; onCommit: (value: number) => boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  return <label className="kp-field">
    <span>{label}</span>
    <span className="kp-number"><input type="number" min={min} max={max} step={1} inputMode="numeric"
      value={draft} onChange={event => setDraft(event.target.value)}
      onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }}
      onBlur={() => {
        const number = draft.trim() === "" ? NaN : Number(draft);
        if (!onCommit(number)) setDraft(String(value));
      }} /><span>мм</span></span>
    <small>{min}–{max} мм</small>
  </label>;
}

function FinishPicker({ label, value, onChange }: { label: string; value: Finish; onChange: (finish: Finish) => void }) {
  return <fieldset className="kp-finishes"><legend>{label}</legend>
    <div>{FINISHES.map(finish => <button type="button" key={finish.id} aria-pressed={value === finish.id}
      onClick={() => onChange(finish.id)}>
      <span className={`kp-swatch kp-swatch-${finish.id}`} style={{ backgroundColor: finish.color }}>
        {value === finish.id && <Check size={16} aria-hidden="true" />}
      </span><span>{finish.name}</span>
    </button>)}</div>
  </fieldset>;
}

export function KitchenPlanner() {
  const [kitchen, setKitchen] = useState<Kitchen>(createKitchen);
  const [selectedId, setSelectedId] = useState("cabinet-1");
  const [open, setOpen] = useState(false);
  const [addKind, setAddKind] = useState<CabinetKind>("single");
  const [error, setError] = useState("");
  const selectedIndex = kitchen.cabinets.findIndex(cabinet => cabinet.id === selectedId);
  const selected = kitchen.cabinets[selectedIndex];
  const used = usedWidth(kitchen.cabinets);
  const remaining = kitchen.width - used;
  const fullHeight = kitchenHeight(kitchen);

  function commit(next: Kitchen): boolean {
    const problem = validateKitchen(next);
    if (problem) { setError(problem); return false; }
    setKitchen(next);
    setError("");
    return true;
  }

  function setDimension(key: DimensionKey, value: number) {
    let cabinets = kitchen.cabinets;
    if (key === "width" && value < used) {
      const fitted = fitCabinets(cabinets, value);
      if (!fitted) { setError("Энэ өргөнд одоогийн шүүгээнүүд багтахгүй. Шүүгээ хасах эсвэл төрлийг нь солино уу."); return false; }
      cabinets = fitted;
    }
    return commit({ ...kitchen, [key]: value, cabinets });
  }

  function updateCabinet(patch: Partial<Cabinet>) {
    return commit({ ...kitchen, cabinets: kitchen.cabinets.map(cabinet => cabinet.id === selectedId ? { ...cabinet, ...patch } : cabinet) });
  }

  function addCabinet() {
    const minimum = CABINET_TYPES[addKind].min;
    if (remaining < minimum) { setError(`Энэ шүүгээнд дор хаяж ${minimum} мм сул зай хэрэгтэй. Нийт өргөнийг нэмэх эсвэл шүүгээний өргөнийг багасгана уу.`); return; }
    const cabinet: Cabinet = { id: crypto.randomUUID(), kind: addKind, width: Math.min(600, remaining), upper: addKind !== "hob" };
    if (commit({ ...kitchen, cabinets: [...kitchen.cabinets, cabinet] })) setSelectedId(cabinet.id);
  }

  function removeCabinet() {
    const cabinets = kitchen.cabinets.filter(cabinet => cabinet.id !== selectedId);
    if (commit({ ...kitchen, cabinets })) setSelectedId(cabinets[Math.min(selectedIndex, cabinets.length - 1)].id);
  }

  function moveCabinet(direction: -1 | 1) {
    const target = selectedIndex + direction;
    if (target < 0 || target >= kitchen.cabinets.length) return;
    const cabinets = [...kitchen.cabinets];
    [cabinets[selectedIndex], cabinets[target]] = [cabinets[target], cabinets[selectedIndex]];
    commit({ ...kitchen, cabinets });
  }

  return <section className="kp shop-container">
    <div className="kp-heading">
      <div><p className="kp-eyebrow">3D ТӨЛӨВЛӨГЧ / ШУЛУУН ГАРНИТУР</p><h1>Гал тогоогоо өөрийнхөөрөө.</h1></div>
      <Link href="/planner">Өрөө төлөвлөх <ArrowRight size={16} aria-hidden="true" /></Link>
    </div>

    <div className="kp-layout">
      <div className="kp-workspace">
        <div className="kp-preview">
          <div className="kp-preview-bar"><span><Ruler size={16} aria-hidden="true" />{kitchen.width} × {kitchen.depth} × {fullHeight} мм</span>
            <button type="button" aria-pressed={open} onClick={() => setOpen(!open)}>{open ? "Хаалгуудыг хаах" : "Хаалгуудыг нээх"}</button>
          </div>
          <div className="kp-canvas" aria-label="Гарнитурын 3D загвар">
            <KitchenViewer kitchen={kitchen} selected={selectedId} onSelect={setSelectedId} open={open} />
          </div>
          <p className="kp-preview-hint">Чирж эргүүлнэ · Гүйлгэж ойртуулна · Шүүгээн дээр дарж сонгоно</p>
        </div>

        <section className="kp-panel kp-modules" aria-labelledby="kp-modules-title">
          <div className="kp-section-heading"><h2 id="kp-modules-title">Шүүгээний байрлал</h2><span>Зүүнээс баруун тийш</span></div>
          <div className="kp-module-list" role="group" aria-label="Шүүгээ сонгох">
            {kitchen.cabinets.map((cabinet, index) => <button key={cabinet.id} type="button"
              aria-pressed={selectedId === cabinet.id} onClick={() => { setSelectedId(cabinet.id); setError(""); }}>
              <span className="kp-module-number">{String(index + 1).padStart(2, "0")}</span>
              <strong>{CABINET_TYPES[cabinet.kind].name}</strong><span>{cabinet.width} мм{cabinet.upper ? " · дээдтэй" : ""}</span>
            </button>)}
          </div>
          <div className="kp-width-status" role="status"><span>Ашигласан <strong>{used} мм</strong></span>
            <span>Сул зай <strong>{remaining} мм</strong></span></div>
          <div className="kp-add-row">
            <label className="kp-field"><span>Нэмэх шүүгээ</span><select value={addKind} onChange={event => setAddKind(event.target.value as CabinetKind)}>
              {Object.entries(CABINET_TYPES).map(([kind, info]) => <option key={kind} value={kind}>{info.name}</option>)}
            </select></label>
            <button type="button" className="kp-primary" onClick={addCabinet}><Plus size={16} aria-hidden="true" />Нэмэх</button>
          </div>
          <button type="button" className="kp-fit" onClick={() => {
            const cabinets = fitCabinets(kitchen.cabinets, kitchen.width);
            if (!cabinets) { setError("Одоогийн шүүгээний тоо, төрлөөр нийт өргөнийг дүүргэх боломжгүй. Шүүгээ нэмэх/хасах эсвэл хэмжээг өөрчилнө үү."); return; }
            commit({ ...kitchen, cabinets });
          }}>Шүүгээнүүдийн өргөнийг нийт хэмжээнд тааруулах</button>
        </section>

        {selected && <section className="kp-panel" aria-labelledby="kp-selected-title">
          <div className="kp-section-heading"><h2 id="kp-selected-title">{selectedIndex + 1}-р шүүгээ</h2>
            <div className="kp-icon-actions">
              <button type="button" aria-label="Шүүгээг зүүн тийш зөөх" disabled={selectedIndex === 0} onClick={() => moveCabinet(-1)}><ArrowLeft size={18} /></button>
              <button type="button" aria-label="Шүүгээг баруун тийш зөөх" disabled={selectedIndex === kitchen.cabinets.length - 1} onClick={() => moveCabinet(1)}><ArrowRight size={18} /></button>
              <button type="button" aria-label="Сонгосон шүүгээг хасах" disabled={kitchen.cabinets.length === 1} onClick={removeCabinet}><Trash2 size={17} /></button>
            </div>
          </div>
          <div className="kp-two-columns">
            <label className="kp-field"><span>Шүүгээний төрөл</span><select value={selected.kind} onChange={event => {
              const kind = event.target.value as CabinetKind;
              updateCabinet({ kind, width: Math.max(selected.width, CABINET_TYPES[kind].min), ...(kind === "hob" ? { upper: false } : {}) });
            }}>{Object.entries(CABINET_TYPES).map(([kind, info]) => <option key={kind} value={kind}>{info.name}</option>)}</select></label>
            <NumberField key={selected.id} label="Шүүгээний өргөн" value={selected.width} min={CABINET_TYPES[selected.kind].min} max={1200}
              onCommit={width => updateCabinet({ width })} />
          </div>
          <label className="kp-checkbox"><input type="checkbox" checked={selected.upper} onChange={event => updateCabinet({ upper: event.target.checked })} />Дээр нь өлгөөтэй шүүгээ нэмэх</label>
        </section>}
        <p className="kp-note">Угаалтуур, плитка нь байрлалын жишиг дүрслэл. Үйлдвэрлэхээс өмнө бодит төхөөрөмж, холболт, угсралтын хэмжээг тулгана.</p>
      </div>

      <aside className="kp-settings" aria-label="Гарнитурын тохиргоо">
        <section className="kp-panel">
          <div className="kp-section-heading"><h2>01 / Хэмжээ</h2><span>Миллиметрээр</span></div>
          <div className="kp-dimensions">{(Object.keys(DIMENSIONS) as DimensionKey[]).map(key => <NumberField key={key}
            {...DIMENSIONS[key]} value={kitchen[key]} onCommit={value => setDimension(key, value)} />)}</div>
          <p className="kp-help">Доод өндөрт 100 мм суурь, 30 мм тавцан багтсан. Өргөнийг багасгахад шүүгээнүүд боломжит хэмжээнд автоматаар таарна.</p>
        </section>
        <section className="kp-panel">
          <h2>02 / Өнгө ба гадаргуу</h2>
          <FinishPicker label="Шүүгээний гадаргуу" value={kitchen.finish} onChange={finish => {
            const preset = FINISHES.find(item => item.id === finish)!;
            commit({ ...kitchen, finish, color: preset.color, upperColor: preset.color });
          }} />
          <div className="kp-colors">
            <label><input type="color" value={kitchen.color} onChange={event => commit({ ...kitchen, color: event.target.value })} /><span>Доод өнгө</span></label>
            <label><input type="color" value={kitchen.upperColor} onChange={event => commit({ ...kitchen, upperColor: event.target.value })} /><span>Дээд өнгө</span></label>
          </div>
          <FinishPicker label="Тавцангийн гадаргуу" value={kitchen.countertop} onChange={countertop => commit({ ...kitchen, countertop })} />
          <label className="kp-checkbox"><input type="checkbox" checked={kitchen.backsplash} onChange={event => commit({ ...kitchen, backsplash: event.target.checked })} />Ханын хамгаалалтын хавтан</label>
        </section>
        <section className="kp-panel">
          <h2>03 / Хаалга ба бариул</h2>
          <label className="kp-field"><span>Хаалганы загвар</span><select value={kitchen.front} onChange={event => commit({ ...kitchen, front: event.target.value as FrontStyle })}>
            <option value="flat">Хавтгай / минимал</option><option value="shaker">Хүрээтэй / классик</option><option value="glass">Шилэн / хүрээтэй</option>
          </select></label>
          <label className="kp-field"><span>Бариул</span><select value={kitchen.handle} onChange={event => commit({ ...kitchen, handle: event.target.value as HandleStyle })}>
            <option value="bar">Урт бариул</option><option value="knob">Дугуй бариул</option><option value="none">Бариулгүй</option>
          </select></label>
          {kitchen.front === "glass" && <p className="kp-help">Шилэн загвар хаалганд үйлчилнэ. Шургуулгын нүүр битүү хэвээр байна.</p>}
        </section>
      </aside>
    </div>
    {error && <div className="kp-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")}>Хаах</button></div>}
  </section>;
}
