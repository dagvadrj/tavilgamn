"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Plus, RotateCw, Trash2 } from "lucide-react";
import { CABINET_DEFAULTS, CABINET_WIDTHS, createCabinet, createModularKitchen, validateCabinet,
  type CabinetPose, type CabinetType, type CabinetWidth, type ModularCabinet, type ModularKitchen } from "@/lib/kitchenCabinets";
import { cabinetAxes, cabinetCorners, findCabinetSpace, fitCountertops, placementIssues, proposeCabinetMove, resolveElevations, wallCabinetClearance } from "@/lib/kitchenPlacement";

const Scene = dynamic(() => import("@/three/ModularKitchenScene").then(module => module.ModularKitchenScene), {
  ssr: false, loading: () => <p className="kp-viewer-message" role="status">3D загварыг бэлдэж байна…</p>,
});
function DimensionInput({ label, value, min, max, onCommit, disabled = false }: {
  label: string; value: number; min: number; max: number; disabled?: boolean; onCommit: (value: number) => void;
}) {
  return <label className="kp-field"><span>{label}</span><span className="kp-number">
    <input key={value} type="number" defaultValue={Math.round(value)} min={min} max={max} step={1} disabled={disabled}
      onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }}
      onBlur={event => {
        const next = event.currentTarget.valueAsNumber;
        if (Number.isInteger(next) && next >= min && next <= max) onCommit(next);
        event.currentTarget.value = String(Math.round(value));
      }} /><span>мм</span></span><small>{min}–{max} мм</small></label>;
}
function Plan({ kitchen, selectedId, onSelect }: { kitchen: ModularKitchen; selectedId: string | null; onSelect: (id: string) => void }) {
  const errors = new Set(placementIssues(kitchen).filter(issue => issue.severity === "error").flatMap(issue => issue.ids));
  const cabinets = [...kitchen.cabinets].sort((a, b) => Number(a.type === "wall") - Number(b.type === "wall"));
  return <svg className="km-plan" viewBox={`-150 -150 ${kitchen.room.width + 300} ${kitchen.room.depth + 300}`} role="group" aria-label="Модуль шүүгээний дээрээс харах зураг">
    <rect x={0} y={0} width={kitchen.room.width} height={kitchen.room.depth} className="km-room-outline" />
    {cabinets.map(cabinet => {
      const { front } = cabinetAxes(cabinet.position.rotation);
      return <g key={cabinet.id} className={`km-plan-cabinet ${cabinet.type === "wall" ? "is-wall" : ""} ${errors.has(cabinet.id) ? "is-invalid" : ""} ${selectedId === cabinet.id ? "is-selected" : ""}`}>
        <polygon points={cabinetCorners(cabinet).map(p => `${p.x},${p.z}`).join(" ")} role="button" tabIndex={0}
          aria-label={`${CABINET_DEFAULTS[cabinet.type].label}, ${cabinet.width} мм`} aria-pressed={selectedId === cabinet.id}
          onClick={() => onSelect(cabinet.id)} onKeyDown={event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); onSelect(cabinet.id); } }} />
        <line x1={cabinet.position.x} y1={cabinet.position.z} x2={cabinet.position.x + front.x * cabinet.depth * .4}
          y2={cabinet.position.z + front.z * cabinet.depth * .4} pointerEvents="none" />
        <text x={cabinet.position.x} y={cabinet.position.z} textAnchor="middle" dominantBaseline="middle" pointerEvents="none" fontSize={80}>{cabinet.width}</text>
      </g>;
    })}
  </svg>;
}
export function ModularKitchenPlanner({ active = true }: { active?: boolean }) {
  const [design, setDesign] = useState<ModularKitchen>(createModularKitchen);
  const designRef = useRef(design); designRef.current = design;
  const [preview, setPreview] = useState<ModularKitchen | null>(null);
  const draftRef = useRef<ModularKitchen | null>(null);
  const dragBase = useRef<ModularKitchen | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>("base-1");
  const [mode, setMode] = useState<"move" | "orbit">("move");
  const [addType, setAddType] = useState<CabinetType>("base");
  const [addWidth, setAddWidth] = useState<CabinetWidth>(600);
  const [message, setMessage] = useState("");
  const [snapMessage, setSnapMessage] = useState("");
  const [dragging, setDragging] = useState(false);
  const kitchen = preview ?? design;
  const selected = kitchen.cabinets.find(c => c.id === selectedId);
  const issues = useMemo(() => placementIssues(kitchen), [kitchen]);
  const tops = useMemo(() => fitCountertops(kitchen), [kitchen]);
  const clearance = selected ? wallCabinetClearance(selected, kitchen) : null;
  function commit(next: ModularKitchen): boolean {
    next = resolveElevations(next);
    const invalid = next.cabinets.map(validateCabinet).find(Boolean);
    const problem = invalid || placementIssues(next).find(issue => issue.severity === "error")?.message;
    if (problem) { setMessage(problem); return false; }
    designRef.current = next; setDesign(next); setMessage(""); return true;
  }
  function start(id: string) {
    setSelectedId(id); dragBase.current = designRef.current; draftRef.current = designRef.current;
    setDragging(true); setMessage("");
  }
  function move(id: string, pose: CabinetPose) {
    if (!dragBase.current) return;
    const result = proposeCabinetMove(dragBase.current, id, pose);
    draftRef.current = result.kitchen; setPreview(result.kitchen);
    setSnapMessage([result.wallId ? "Хананд таарлаа" : "", result.neighbourId ? "Шүүгээтэй зайгүй таарлаа" : ""].filter(Boolean).join(" · "));
  }
  function finish(cancel = false) {
    if (!dragBase.current) return;
    const next = draftRef.current;
    if (!cancel && next && !commit(next)) setMessage("Энд байрлуулах боломжгүй тул өмнөх байрлалд буцаалаа.");
    dragBase.current = null; draftRef.current = null; setPreview(null); setDragging(false); setSnapMessage("");
  }
  function updateCabinet(patch: Partial<ModularCabinet>) {
    if (!selected || dragging) return;
    commit({ ...design, cabinets: design.cabinets.map(c => c.id === selected.id ? { ...c, ...patch } : c) });
  }
  function updatePose(patch: Partial<CabinetPose>) {
    if (!selected || dragging) return;
    commit(proposeCabinetMove(design, selected.id, { ...selected.position, ...patch }).kitchen);
  }
  function addCabinet() {
    const cabinet = createCabinet(addType, crypto.randomUUID(), addWidth, design.room.height);
    const next = findCabinetSpace(design, cabinet);
    if (!next) { setMessage("Энэ хэмжээтэй шүүгээ багтах сул ханын зай алга. Шүүгээ зөөх, хасах эсвэл өрөөг томруулна уу."); return; }
    if (commit(next)) setSelectedId(cabinet.id);
  }
  return <main className="kp container-page">
    <header className="kp-heading"><div><p className="kp-eyebrow">ГАЛ ТОГОО ТӨЛӨВЛӨХ</p><h1>Модуль шүүгээгээ байрлуул</h1></div>
      <Link href="/planner"><ArrowLeft size={16} />Өрөө төлөвлөх</Link></header>
    <div className="kp-layout"><div className="kp-workspace">
      <section className="kp-preview" aria-label="Модуль шүүгээ байрлуулах">
        <div className="kp-preview-bar"><span>{kitchen.cabinets.length} шүүгээ · Тавцан {tops.reduce((sum, top) => sum + top.width, 0)} мм</span>
          <div className="km-view-tools" role="group" aria-label="3D үйлдэл">
            <button type="button" disabled={dragging} aria-pressed={mode === "move"} onClick={() => setMode("move")}>Шүүгээ зөөх</button>
            <button type="button" disabled={dragging} aria-pressed={mode === "orbit"} onClick={() => setMode("orbit")}>Харах өнцөг</button>
          </div></div>
        <div className="kp-canvas">{active && <Scene kitchen={kitchen} selectedId={selectedId} mode={mode} onSelect={setSelectedId}
          onStart={start} onMove={move} onEnd={() => finish()} onCancel={() => finish(true)} />}</div>
        <p className="kp-preview-hint">{mode === "move" ? "Шүүгээг чирж байрлуулна · Улаан хүрээ: байрлуулах боломжгүй · Esc: буцаах" : "Чирж харах өнцгийг эргүүлнэ · Гүйлгэж ойртуулна"}</p>
        <p className={`km-feedback ${issues.some(issue => issue.severity === "error") ? "has-error" : ""}`} role="status" aria-live="polite">
          {issues[0]?.message || snapMessage || "Хананд болон залгаа шүүгээнд автоматаар таарна."}</p>
      </section>
      <section className="kp-panel"><div className="kp-section-heading"><h2>Байрлал</h2><span>Тасархай хүрээ: дээд шүүгээ</span></div>
        <Plan kitchen={kitchen} selectedId={selectedId} onSelect={setSelectedId} />
        <div className="kp-module-list" role="group" aria-label="Шүүгээ сонгох">
          {kitchen.cabinets.map((cabinet, i) => <button key={cabinet.id} type="button" disabled={dragging} aria-pressed={selectedId === cabinet.id} onClick={() => setSelectedId(cabinet.id)}>
            <span className="kp-module-number">{i + 1}</span><strong>{CABINET_DEFAULTS[cabinet.type].label}</strong><span>{cabinet.width} × {cabinet.height} × {cabinet.depth} мм</span>
          </button>)}
        </div>
        {!kitchen.cabinets.length && <p className="km-empty">Эхний шүүгээгээ баруун талын сонголтоос нэмээрэй.</p>}
      </section>
      <section className="kp-panel"><h2>Тавцангийн хэмжээ</h2>
        {tops.length ? <ul className="km-top-list">{tops.map((top, index) => <li key={top.id}>Тавцан {index + 1}: <strong>{top.width} × {top.depth} × {top.thickness} мм</strong> · {top.cabinetIds.length} доод шүүгээ</li>)}</ul>
          : <p className="kp-help">Доод шүүгээ нэмэхэд тавцан автоматаар үүснэ.</p>}
      </section>
    </div><aside className="kp-settings" aria-label="Шүүгээний тохиргоо">
      <section className="kp-panel"><h2>Шүүгээ нэмэх</h2>
        <div className="km-fields"><label className="kp-field"><span>Төрөл</span><select value={addType} disabled={dragging} onChange={e => setAddType(e.target.value as CabinetType)}>
          {Object.entries(CABINET_DEFAULTS).map(([type, spec]) => <option key={type} value={type}>{spec.label}</option>)}</select></label>
          <label className="kp-field"><span>Өргөн</span><select value={addWidth} disabled={dragging} onChange={e => setAddWidth(Number(e.target.value) as CabinetWidth)}>
            {CABINET_WIDTHS.map(width => <option key={width} value={width}>{width / 10} см</option>)}</select></label>
          <button type="button" className="kp-primary" onClick={addCabinet} disabled={dragging || kitchen.cabinets.length >= 80}><Plus size={16} />Шүүгээ нэмэх</button></div>
      </section>
      {selected && <section className="kp-panel"><div className="kp-section-heading"><h2>{CABINET_DEFAULTS[selected.type].label}</h2>
        <button type="button" className="km-delete" disabled={dragging} aria-label="Сонгосон шүүгээг устгах" onClick={() => {
          const next = { ...design, cabinets: design.cabinets.filter(c => c.id !== selected.id) };
          if (commit(next)) setSelectedId(next.cabinets[0]?.id ?? null);
        }}><Trash2 size={18} /></button></div>
        <fieldset className="km-fields" disabled={dragging} key={selected.id}>
          <label className="kp-field"><span>Өргөн</span><select value={selected.width} onChange={e => {
            const width = Number(e.target.value) as CabinetWidth; updateCabinet({ width, doorCount: width < 600 ? 1 : selected.doorCount });
          }}>{CABINET_WIDTHS.map(width => <option key={width} value={width}>{width} мм</option>)}</select></label>
          <DimensionInput label="Өндөр" value={selected.height} min={CABINET_DEFAULTS[selected.type].heightRange[0]} max={CABINET_DEFAULTS[selected.type].heightRange[1]}
            disabled={selected.type === "tall" && selected.fitToCeiling} onCommit={height => updateCabinet({ height })} />
          <DimensionInput label="Гүн" value={selected.depth} min={CABINET_DEFAULTS[selected.type].depthRange[0]} max={CABINET_DEFAULTS[selected.type].depthRange[1]} onCommit={depth => {
            const { front } = cabinetAxes(selected.position.rotation), delta = (depth - selected.depth) / 2;
            updateCabinet({ depth, position: { ...selected.position, x: selected.position.x + front.x * delta, z: selected.position.z + front.z * delta } });
          }} />
          <label className="kp-field"><span>Хаалганы тоо</span><select value={selected.doorCount} onChange={e => updateCabinet({ doorCount: Number(e.target.value) as 1 | 2 })}>
            <option value={1}>1 хаалга</option><option value={2} disabled={selected.width < 600}>2 хаалга</option></select></label>
          {selected.type !== "wall" && <label className="kp-field"><span>Дээд шургуулганы тоо</span><select value={selected.drawerCount} onChange={e => updateCabinet({ drawerCount: Number(e.target.value) })}>
            {[0, 1, 2, 3, 4].map(count => <option key={count} value={count}>{count}</option>)}</select></label>}
          {selected.type === "tall" && <label className="kp-checkbox"><input type="checkbox" checked={selected.fitToCeiling} onChange={e => updateCabinet({ fitToCeiling: e.target.checked })} />Таазны өндөрт тааруулах</label>}
          {selected.type === "wall" && <>
            <label className="kp-checkbox"><input type="checkbox" checked={selected.autoElevation} onChange={e => updateCabinet({ autoElevation: e.target.checked })} />Тавцангаас өндрийг автоматаар тооцох</label>
            <DimensionInput label="Шалнаас доод ирмэг хүртэл" value={selected.position.y} min={0} max={kitchen.room.height - selected.height}
              disabled={selected.autoElevation} onCommit={y => updateCabinet({ position: { ...selected.position, y } })} />
            <p className="km-clearance">{clearance === null ? "Доор нь доод шүүгээ байрлаагүй байна." : `Тавцангаас зай: ${Math.round(clearance)} мм`}</p>
          </>}
          <details className="km-details"><summary>Байрлалыг хэмжээгээр тохируулах</summary><div className="km-fields">
            <DimensionInput label="Зүүн хананаас төв хүртэл (X)" value={selected.position.x} min={0} max={kitchen.room.width} onCommit={x => updatePose({ x })} />
            <DimensionInput label="Арын хананаас төв хүртэл (Z)" value={selected.position.z} min={0} max={kitchen.room.depth} onCommit={z => updatePose({ z })} />
            <button type="button" className="kp-primary" onClick={() => {
              // Explicit rotation is not immediately snapped back to the same wall.
              updateCabinet({ position: { ...selected.position, rotation: selected.position.rotation + Math.PI / 2 } });
            }}><RotateCw size={16} />90° эргүүлэх</button>
          </div></details>
        </fieldset>
      </section>}
      <details className="kp-panel km-details"><summary>Өрөөний хэмжээ ба дээд шүүгээний зай</summary><fieldset className="km-fields" disabled={dragging}>
        {([['width', 'Өрөөний өргөн', 2000, 8000], ['depth', 'Өрөөний урт', 2000, 8000], ['height', 'Таазны өндөр', 2200, 3500]] as const).map(([key, label, min, max]) =>
          <DimensionInput key={key} label={label} value={design.room[key]} min={min} max={max} onCommit={value => commit({ ...design, room: { ...design.room, [key]: value } })} />)}
        <DimensionInput label="Тавцангаас дээд шүүгээний зай" value={design.wallClearance} min={450} max={600} onCommit={wallClearance => commit({ ...design, wallClearance })} />
      </fieldset></details>
    </aside></div>
    {message && <div className="kp-error" role="alert"><span>{message}</span><button type="button" onClick={() => setMessage("")}>Хаах</button></div>}
  </main>;
}
