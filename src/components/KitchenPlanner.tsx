"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Plus, Ruler, Trash2 } from "lucide-react";
import {
  CABINET_TYPES, DIMENSIONS, FINISHES, activeRuns, cabinetMinimumWidth, changeKitchenLayout,
  createKitchen, fitCabinets, kitchenHeight, kitchenPlan, runCabinets, runCapacity, usedWidth, validateKitchen, withRunCabinets,
  type Cabinet, type CabinetKind, type DimensionKey, type Finish, type FrontStyle, type HandleStyle, type Kitchen, type RunId, type UpperKind,
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

function FloorPlan({ kitchen, selected, onSelect }: { kitchen: Kitchen; selected: string; onSelect: (id: string) => void }) {
  const plan = kitchenPlan(kitchen);
  const pad = Math.max(plan.width, plan.depth) * 0.12;
  const fontSize = Math.max(plan.width, plan.depth) / 30;
  const activate = (id: string, key: string, preventDefault: () => void) => {
    if (key === "Enter" || key === " ") { preventDefault(); onSelect(id); }
  };
  return <svg className="kp-floor-plan" viewBox={`${-pad} ${-pad} ${plan.width + pad * 2} ${plan.depth + pad * 2}`}
    aria-label="Гарнитурын дээрээс харсан байрлал, хэмжээс" role="group">
    <text x={plan.width / 2} y={-pad * 0.4} textAnchor="middle" fontSize={fontSize}>A · {kitchen.width} мм</text>
    {kitchen.layout === "l" && <text x={plan.mirrored ? -pad * 0.5 : plan.width + pad * 0.5} y={plan.depth / 2}
      transform={`rotate(${plan.mirrored ? -90 : 90}, ${plan.mirrored ? -pad * 0.5 : plan.width + pad * 0.5}, ${plan.depth / 2})`}
      textAnchor="middle" fontSize={fontSize}>B · {kitchen.returnWidth} мм</text>}
    {plan.placements.map(({ cabinet, run, bounds }) => <g key={cabinet.id}>
      <rect x={bounds.minX + 3} y={bounds.minZ + 3} width={bounds.maxX - bounds.minX - 6} height={bounds.maxZ - bounds.minZ - 6}
        tabIndex={0} role="button" aria-pressed={selected === cabinet.id}
        aria-label={`${run === "main" ? "A" : "B"} тал, ${CABINET_TYPES[cabinet.kind].name}, ${cabinet.width} мм`}
        className={selected === cabinet.id ? "selected" : ""} onClick={() => onSelect(cabinet.id)}
        onKeyDown={event => activate(cabinet.id, event.key, () => event.preventDefault())} />
      <text x={(bounds.minX + bounds.maxX) / 2} y={(bounds.minZ + bounds.maxZ) / 2} dominantBaseline="middle"
        textAnchor="middle" fontSize={fontSize * 0.8} pointerEvents="none">{cabinet.width}</text>
    </g>)}
    {plan.corner && <g>
      <polygon points={plan.cornerPoints.map(point => point.join(",")).join(" ")}
        className={`kp-plan-corner ${selected === "corner" ? "selected" : ""}`}
        tabIndex={0} role="button" aria-label={`Булангийн модуль ${kitchen.cornerSize} мм`} aria-pressed={selected === "corner"}
        onClick={() => onSelect("corner")} onKeyDown={event => activate("corner", event.key, () => event.preventDefault())} />
      <text x={(plan.corner.minX + plan.corner.maxX) / 2} y={kitchen.cornerSize / 2} fontSize={fontSize * 0.8}
        textAnchor="middle" dominantBaseline="middle" pointerEvents="none">Булан</text>
    </g>}
  </svg>;
}

export function KitchenPlanner() {
  const [kitchen, setKitchen] = useState<Kitchen>(createKitchen);
  const [selectedId, setSelectedId] = useState("cabinet-1");
  const [activeRun, setActiveRun] = useState<RunId>("main");
  const [open, setOpen] = useState(false);
  const [addKind, setAddKind] = useState<CabinetKind>("single");
  const [error, setError] = useState("");
  const cabinets = runCabinets(kitchen, activeRun);
  const selectedIndex = cabinets.findIndex(cabinet => cabinet.id === selectedId);
  const selected = cabinets[selectedIndex];
  const used = usedWidth(cabinets);
  const capacity = runCapacity(kitchen, activeRun);
  const remaining = capacity - used;
  const runLabel = activeRun === "main" ? "A" : "B";
  const fullHeight = kitchenHeight(kitchen);

  function commit(next: Kitchen): boolean {
    const problem = validateKitchen(next);
    if (problem) { setError(problem); return false; }
    setKitchen(next);
    setError("");
    return true;
  }

  function setDimension(key: DimensionKey, value: number) {
    let next = { ...kitchen, [key]: value };
    for (const run of activeRuns(next)) {
      const modules = runCabinets(next, run);
      const available = runCapacity(next, run);
      if (usedWidth(modules) <= available) continue;
      const fitted = fitCabinets(modules, available);
      if (!fitted) { setError(`${run === "main" ? "A" : "B"} талд шүүгээнүүд багтахгүй. Булангийн зайг тооцож уртыг нэмэх, шүүгээ хасах эсвэл төрлийг нь солино уу.`); return false; }
      next = withRunCabinets(next, run, fitted);
    }
    return commit(next);
  }

  function updateCabinet(patch: Partial<Cabinet>) {
    return commit(withRunCabinets(kitchen, activeRun, cabinets.map(cabinet => cabinet.id === selectedId ? { ...cabinet, ...patch } : cabinet)));
  }

  function selectCabinet(id: string) {
    if (kitchen.returnCabinets.some(cabinet => cabinet.id === id) && kitchen.layout === "l") setActiveRun("return");
    else if (id !== "corner") setActiveRun("main");
    setSelectedId(id);
    setError("");
  }

  function selectLayout(layout: Kitchen["layout"], cornerSide = kitchen.cornerSide) {
    const next = { ...changeKitchenLayout(kitchen, layout), cornerSide };
    if (commit(next) && layout === "straight") { setActiveRun("main"); setSelectedId(next.cabinets[0].id); }
  }

  function addCabinet() {
    const minimum = CABINET_TYPES[addKind].min;
    if (remaining < minimum) { setError(`Энэ шүүгээнд дор хаяж ${minimum} мм сул зай хэрэгтэй. Нийт өргөнийг нэмэх эсвэл шүүгээний өргөнийг багасгана уу.`); return; }
    const cabinet: Cabinet = { id: crypto.randomUUID(), kind: addKind, width: Math.min(600, remaining), upper: addKind !== "hob" };
    if (commit(withRunCabinets(kitchen, activeRun, [...cabinets, cabinet]))) setSelectedId(cabinet.id);
  }

  function removeCabinet() {
    const next = cabinets.filter(cabinet => cabinet.id !== selectedId);
    if (commit(withRunCabinets(kitchen, activeRun, next))) setSelectedId(next[Math.min(selectedIndex, next.length - 1)].id);
  }

  function moveCabinet(direction: -1 | 1) {
    const target = selectedIndex + direction;
    if (target < 0 || target >= cabinets.length) return;
    const next = [...cabinets];
    [next[selectedIndex], next[target]] = [next[target], next[selectedIndex]];
    commit(withRunCabinets(kitchen, activeRun, next));
  }

  function transferCabinet() {
    if (!selected) return;
    const otherRun = activeRun === "main" ? "return" : "main";
    let next = withRunCabinets(kitchen, activeRun, cabinets.filter(cabinet => cabinet.id !== selectedId));
    next = withRunCabinets(next, otherRun, [...runCabinets(next, otherRun), selected]);
    if (commit(next)) setActiveRun(otherRun);
  }

  return <section className="kp shop-container">
    <div className="kp-heading">
      <div><p className="kp-eyebrow">3D ТӨЛӨВЛӨГЧ / {kitchen.layout === "l" ? "БУЛАНТАЙ ГАРНИТУР" : "ШУЛУУН ГАРНИТУР"}</p><h1>Гал тогоогоо өөрийнхөөрөө.</h1></div>
      <Link href="/planner">Өрөө төлөвлөх <ArrowRight size={16} aria-hidden="true" /></Link>
    </div>

    <div className="kp-layout">
      <div className="kp-workspace">
        <fieldset className="kp-layout-picker"><legend>Гарнитурын хэлбэр</legend>
          <button type="button" aria-pressed={kitchen.layout === "straight"} onClick={() => selectLayout("straight")}>Шулуун</button>
          <button type="button" aria-pressed={kitchen.layout === "l" && kitchen.cornerSide === "right"} onClick={() => selectLayout("l", "right")}>L · баруун булан</button>
          <button type="button" aria-pressed={kitchen.layout === "l" && kitchen.cornerSide === "left"} onClick={() => selectLayout("l", "left")}>L · зүүн булан</button>
        </fieldset>
        <div className="kp-preview">
          <div className="kp-preview-bar"><span><Ruler size={16} aria-hidden="true" />{kitchen.layout === "l"
            ? `A ${kitchen.width} · B ${kitchen.returnWidth} · Өндөр ${fullHeight} мм`
            : `${kitchen.width} × ${kitchen.depth} × ${fullHeight} мм`}</span>
            <button type="button" aria-pressed={open} onClick={() => setOpen(!open)}>{open ? "Хаалгуудыг хаах" : "Хаалгуудыг нээх"}</button>
          </div>
          <div className="kp-canvas" aria-label="Гарнитурын 3D загвар">
            <KitchenViewer kitchen={kitchen} selected={selectedId} onSelect={selectCabinet} open={open} />
          </div>
          <p className="kp-preview-hint">Чирж эргүүлнэ · Гүйлгэж ойртуулна · Шүүгээн дээр дарж сонгоно</p>
        </div>

        <section className="kp-panel kp-modules" aria-labelledby="kp-modules-title">
          <div className="kp-section-heading"><h2 id="kp-modules-title">Шүүгээний байрлал</h2><span>Дээрээс харах</span></div>
          <FloorPlan kitchen={kitchen} selected={selectedId} onSelect={selectCabinet} />
          {kitchen.layout === "l" && <div className="kp-run-picker" role="group" aria-label="Тохируулах тал">
            {activeRuns(kitchen).map(run => <button key={run} type="button" aria-pressed={activeRun === run}
              onClick={() => { setActiveRun(run); setSelectedId(runCabinets(kitchen, run)[0].id); setError(""); }}>
              {run === "main" ? "A тал" : "B тал"} · {runCabinets(kitchen, run).length} шүүгээ
            </button>)}
          </div>}
          <p className="kp-run-hint">{kitchen.layout === "straight" ? "Зүүнээс баруун тийш" : activeRun === "main" ? "A тал: гадна үзүүрээс булан руу" : "B тал: булангаас гадна үзүүр рүү"}</p>
          <div className="kp-module-list" role="group" aria-label="Шүүгээ сонгох">
            {cabinets.map((cabinet, index) => <button key={cabinet.id} type="button"
              aria-pressed={selectedId === cabinet.id} onClick={() => selectCabinet(cabinet.id)}>
              <span className="kp-module-number">{runLabel}{String(index + 1).padStart(2, "0")}</span>
              <strong>{CABINET_TYPES[cabinet.kind].name}</strong><span>{cabinet.width} мм{cabinet.upper ? " · дээдтэй" : ""}</span>
            </button>)}
          </div>
          <div className="kp-width-status" role="status"><span>Ашигласан <strong>{used} мм</strong></span>
            <span>Сул зай <strong>{remaining} мм</strong></span></div>
          {kitchen.layout === "l" && <p className="kp-help">{runLabel} талын шүүгээнд {capacity} мм. Нийт уртын {kitchen.cornerSize} мм нь булангийн модульд орно.</p>}
          <div className="kp-add-row">
            <label className="kp-field"><span>Нэмэх шүүгээ</span><select value={addKind} onChange={event => setAddKind(event.target.value as CabinetKind)}>
              {Object.entries(CABINET_TYPES).map(([kind, info]) => <option key={kind} value={kind}>{info.name}</option>)}
            </select></label>
            <button type="button" className="kp-primary" onClick={addCabinet}><Plus size={16} aria-hidden="true" />Нэмэх</button>
          </div>
          <button type="button" className="kp-fit" onClick={() => {
            const fitted = fitCabinets(cabinets, capacity);
            if (!fitted) { setError("Одоогийн шүүгээний тоо, төрлөөр энэ талын уртыг дүүргэх боломжгүй. Шүүгээ нэмэх/хасах эсвэл хэмжээг өөрчилнө үү."); return; }
            commit(withRunCabinets(kitchen, activeRun, fitted));
          }}>{runLabel} талын шүүгээнүүдийг уртад нь тааруулах</button>
        </section>

        {selected && <section className="kp-panel" aria-labelledby="kp-selected-title">
          <div className="kp-section-heading"><h2 id="kp-selected-title">{runLabel}{selectedIndex + 1} шүүгээ</h2>
            <div className="kp-icon-actions">
              <button type="button" aria-label="Шүүгээг өмнөх байрлалд зөөх" disabled={selectedIndex === 0} onClick={() => moveCabinet(-1)}><ArrowLeft size={18} /></button>
              <button type="button" aria-label="Шүүгээг дараагийн байрлалд зөөх" disabled={selectedIndex === cabinets.length - 1} onClick={() => moveCabinet(1)}><ArrowRight size={18} /></button>
              <button type="button" aria-label="Сонгосон шүүгээг хасах" disabled={cabinets.length === 1} onClick={removeCabinet}><Trash2 size={17} /></button>
            </div>
          </div>
          <div className="kp-two-columns">
            <label className="kp-field"><span>Шүүгээний төрөл</span><select value={selected.kind} onChange={event => {
              const kind = event.target.value as CabinetKind;
              updateCabinet({ kind, width: Math.max(selected.width, CABINET_TYPES[kind].min), ...(kind === "hob" ? { upper: false } : {}) });
            }}>{Object.entries(CABINET_TYPES).map(([kind, info]) => <option key={kind} value={kind}>{info.name}</option>)}</select></label>
            <NumberField key={selected.id} label="Шүүгээний өргөн" value={selected.width} min={cabinetMinimumWidth(selected)} max={1200}
              onCommit={width => updateCabinet({ width })} />
          </div>
          <label className="kp-checkbox"><input type="checkbox" checked={selected.upper} onChange={event => updateCabinet({ upper: event.target.checked })} />Дээр нь өлгөөтэй шүүгээ нэмэх</label>
          {selected.upper && <label className="kp-field"><span>Дээд шүүгээний төрөл</span>
            <select value={selected.upperKind ?? "auto"} onChange={event => {
              const upperKind = event.target.value as UpperKind;
              updateCabinet({ upperKind, width: Math.max(selected.width, cabinetMinimumWidth({ ...selected, upperKind })) });
            }}><option value="auto">Өргөндөө таарсан хаалгатай</option><option value="single">Нэг хаалгатай</option>
              <option value="double">Хос хаалгатай</option><option value="open">Ил тавиур</option></select>
          </label>}
          {kitchen.layout === "l" && <button type="button" className="kp-fit" disabled={cabinets.length === 1} onClick={transferCabinet}>
            Энэ шүүгээг {activeRun === "main" ? "B" : "A"} талд шилжүүлэх
          </button>}
        </section>}
        {selectedId === "corner" && kitchen.layout === "l" && <section className="kp-panel">
          <h2>Булангийн модуль</h2>
          <NumberField label="Хоёр ханын дагуух хэмжээ" value={kitchen.cornerSize} min={Math.max(850, kitchen.depth + 300)} max={1200}
            onCommit={value => setDimension("cornerSize", value)} />
          <label className="kp-checkbox"><input type="checkbox" checked={kitchen.cornerUpper}
            onChange={event => commit({ ...kitchen, cornerUpper: event.target.checked })} />Булангийн дээд шүүгээ</label>
          <p className="kp-help">Булан нэг диагональ хаалгатай. A, B талын уртаас тус бүр энэ хэмжээг хасаж шүүгээг байрлуулна.</p>
        </section>}
        <p className="kp-note">Угаалтуур, плитка нь байрлалын жишиг дүрслэл. Үйлдвэрлэхээс өмнө бодит төхөөрөмж, холболт, угсралтын хэмжээг тулгана.</p>
      </div>

      <aside className="kp-settings" aria-label="Гарнитурын тохиргоо">
        <section className="kp-panel">
          <div className="kp-section-heading"><h2>01 / Хэмжээ</h2><span>Миллиметрээр</span></div>
          <div className="kp-dimensions">{(Object.keys(DIMENSIONS) as DimensionKey[])
            .filter(key => kitchen.layout === "l" || (key !== "returnWidth" && key !== "cornerSize"))
            .map(key => <NumberField key={key} {...DIMENSIONS[key]}
              min={key === "cornerSize" ? Math.max(850, kitchen.depth + 300) : DIMENSIONS[key].min}
              value={kitchen[key]} onCommit={value => setDimension(key, value)} />)}</div>
          <p className="kp-help">Доод өндөрт 100 мм суурь, 30 мм тавцан багтсан. L хэлбэрт шилжихэд булангийн зайг тооцно; шүүгээнүүд багтахгүй бол тухайн талын урт нэмэгдэнэ.</p>
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
