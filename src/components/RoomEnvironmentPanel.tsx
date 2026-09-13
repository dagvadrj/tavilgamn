"use client";

import { useState } from "react";
import { Check, DoorOpen, Lightbulb, Moon, Plus, Sun, Trash2, X } from "lucide-react";
import type { RoomDesign, RoomOpening, RoomWall, WallMaterial, RoomLighting } from "@/lib/types";
import { ROOM_WALLS, getRoomGeometry } from "@/lib/roomGeometry";
import { OPENING_TEMPLATES, wallLength } from "@/lib/roomOpenings";
import { CEILING_MATERIALS, FLOOR_MATERIALS, WALLPAPER_MATERIALS } from "@/lib/roomMaterials";

export type EnvironmentTab = "room" | "surfaces" | "openings" | "lighting";
type RoomPatch = Partial<Pick<RoomDesign, "floorMaterial" | "floorColor" | "wallMaterials" | "wallColor" | "ceilingMaterial" | "lighting" | "openings">>;
interface Props {
  design: RoomDesign;
  tab: EnvironmentTab;
  surface: "floor" | "wall" | "ceiling";
  onSurfaceChange: (surface: "floor" | "wall" | "ceiling") => void;
  selectedWall: RoomWall | null;
  onSelectWall: (wall: RoomWall) => void;
  selectedOpening: string | null;
  onSelectOpening: (id: string | null) => void;
  placementTemplate: string | null;
  onArmPlacement: (id: string | null) => void;
  onAddOpening: (templateId: string, wall: RoomWall) => void;
  onUpdateOpening: (opening: RoomOpening) => void;
  onUpdate: (patch: RoomPatch) => void;
  onHeight: (height: number) => void;
  onNotice: (message: string) => void;
  beginEdit: () => void;
  endEdit: () => void;
}

const WALLS = Object.keys(ROOM_WALLS) as RoomWall[];
const PAINT_COLORS = ["#F7F4EE", "#EFE6D6", "#D6CFC1", "#A8B5A0", "#BBC8CF", "#C9A494", "#1F2638", "#3D2F26"];
const DEFAULT_LIGHTING: RoomLighting = { mode: "day", ambient: 0.65, sunlight: 1.8, fixtures: [] };

function Swatches({ items, value, onChange }: {
  items: ReadonlyArray<{ id: string; label: string; swatch: string; description: string }>;
  value?: string; onChange: (id: string) => void;
}) {
  return <div className="room-material-grid">{items.map(item => <button type="button" key={item.id}
    className="room-material-swatch" aria-pressed={value === item.id} aria-label={item.label}
    title={item.description} onClick={() => onChange(item.id)}>
    <span className="room-material-sample" style={{ background: item.swatch }}>{value === item.id && <Check size={14} />}</span>
    <span>{item.label}</span>
  </button>)}</div>;
}

/** Keep partially typed measurements local; commit only complete values. */
function MeasureInput({ label, value, min, max, step = 1, unit = "см", onChange, beginEdit, endEdit }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string;
  onChange: (value: number) => void; beginEdit: () => void; endEdit: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return <label className="room-dimension-field"><span>{label}</span><span>
    <input aria-label={label} type="number" inputMode="decimal" min={min} max={max} step={step}
      value={draft ?? Number(value.toFixed(2))} onFocus={beginEdit}
      onChange={event => setDraft(event.target.value)}
      onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }}
      onBlur={() => { if (draft !== null && draft.trim() && Number.isFinite(Number(draft))) onChange(Number(draft)); setDraft(null); endEdit(); }} />
    <small>{unit}</small></span></label>;
}

function LightRange({ label, value, min = 0, max, step = 0.05, onChange, beginEdit, endEdit, format }: {
  label: string; value: number; min?: number; max: number; step?: number; onChange: (v: number) => void;
  beginEdit: () => void; endEdit: () => void; format?: (v: number) => string;
}) {
  return <label className="room-range"><span>{label}<output>{format ? format(value) : `${Math.round(value * 100)}%`}</output></span>
    <input type="range" aria-label={label} min={min} max={max} step={step} value={value}
      onPointerDown={beginEdit} onPointerUp={endEdit} onPointerCancel={endEdit} onFocus={beginEdit} onBlur={endEdit}
      onChange={event => onChange(Number(event.target.value))} /></label>;
}

export function RoomEnvironmentPanel(props: Props) {
  const { design, tab, surface, onSurfaceChange: setSurface, selectedWall, onSelectWall, selectedOpening, onSelectOpening, placementTemplate,
    onArmPlacement, onAddOpening, onUpdateOpening, onUpdate, onHeight, onNotice, beginEdit, endEdit } = props;
  const [floorCategory, setFloorCategory] = useState("Бүгд");
  const [wallScope, setWallScope] = useState<"selected" | "all">("selected");
  const [placementWall, setPlacementWall] = useState<RoomWall>("north");
  const wall = selectedWall ?? "north";
  const finish = design.wallMaterials?.[wall] ?? { mode: "color", color: design.wallColor };
  const opening = design.openings?.find(item => item.id === selectedOpening);
  const lighting = design.lighting ?? DEFAULT_LIGHTING;
  const edit = { beginEdit, endEdit };
  const applyWall = (next: WallMaterial) => {
    const walls = { ...design.wallMaterials };
    for (const id of wallScope === "all" ? WALLS : [wall]) walls[id] = { ...next };
    onUpdate({ wallMaterials: walls, ...(wallScope === "all" && next.mode === "color" ? { wallColor: next.color } : {}) });
  };
  const updateLighting = (patch: Partial<RoomLighting>) => onUpdate({ lighting: { ...lighting, ...patch } });

  return <div className="room-environment-panel" role="region" aria-label="Өрөө тохижуулах">
    {tab === "surfaces" && <>
      <div className="room-panel-intro"><h3>Өнгө, материал</h3><p>Материал сонгоход өрөө шууд шинэчлэгдэнэ.</p></div>
      <div className="room-surface-tabs" aria-label="Гадаргуу сонгох">{([
        ["floor", "Шал"], ["wall", "Хана"], ["ceiling", "Тааз"],
      ] as const).map(([id, label]) => <button key={id} aria-pressed={surface === id} onClick={() => setSurface(id)}>{label}</button>)}</div>

      {surface === "floor" && <section className="room-control-section">
        <div className="room-filter-chips">{["Бүгд", ...Array.from(new Set(FLOOR_MATERIALS.map(item => item.category)))].map(category =>
          <button key={category} aria-pressed={floorCategory === category} onClick={() => setFloorCategory(category)}>{category}</button>)}</div>
        <Swatches items={FLOOR_MATERIALS.filter(item => floorCategory === "Бүгд" || item.category === floorCategory)} value={design.floorMaterial ?? "parquet-oak"}
          onChange={id => onUpdate({ floorMaterial: id, floorColor: FLOOR_MATERIALS.find(item => item.id === id)!.color })} />
        <p className="room-control-help">Хээний бодит хэмжээ өрөө томорсон ч хэвээр үлдэнэ.</p>
      </section>}

      {surface === "wall" && <section className="room-control-section">
        <label className="planner-number"><span>Тохируулах хана</span><select aria-label="Тохируулах хана" value={wall} onChange={event => onSelectWall(event.target.value as RoomWall)}>
          {WALLS.map(id => <option value={id} key={id}>{ROOM_WALLS[id]}</option>)}
        </select></label>
        <p className="room-control-help">3D дээр хананд эсвэл доод хүрээнд нь дарж сонгож болно.</p>
        <div className="room-scope-options" aria-label="Ханын материал хэрэгжүүлэх хүрээ">
          <label><input type="radio" name="wall-scope" checked={wallScope === "selected"} onChange={() => setWallScope("selected")} />Зөвхөн сонгосон хананд</label>
          <label><input type="radio" name="wall-scope" checked={wallScope === "all"} onChange={() => setWallScope("all")} />Бүх хананд</label>
        </div>
        <div className="room-surface-tabs"><button aria-pressed={finish.mode === "color"} onClick={() => applyWall({ mode: "color", color: finish.color })}>Будаг</button>
          <button aria-pressed={finish.mode === "wallpaper"} onClick={() => applyWall({ mode: "wallpaper", color: "#ffffff", materialId: finish.materialId ?? "wallpaper-linen" })}>Ханын цаас</button></div>
        {finish.mode === "color" ? <>
          <div className="room-paint-colors">{PAINT_COLORS.map(color => <button key={color} style={{ background: color }} aria-label={`Ханын өнгө ${color}`}
            aria-pressed={finish.color.toLowerCase() === color.toLowerCase()} onClick={() => applyWall({ mode: "color", color })}>{finish.color.toLowerCase() === color.toLowerCase() && <Check size={15} />}</button>)}</div>
          <label className="room-color-picker"><span>Өөр өнгө сонгох</span><input type="color" aria-label="Ханын өнгө сонгох" value={finish.color}
            onFocus={beginEdit} onBlur={endEdit} onChange={event => applyWall({ mode: "color", color: event.target.value })} /><small>{finish.color.toUpperCase()}</small></label>
        </> : <Swatches items={WALLPAPER_MATERIALS} value={finish.materialId} onChange={id => applyWall({ mode: "wallpaper", materialId: id, color: "#ffffff" })} />}
        {wallScope === "all" && <button className="room-secondary-action" onClick={() => applyWall(finish)}>Энэ материалыг бүх хананд хэрэгжүүлэх</button>}
      </section>}

      {surface === "ceiling" && <section className="room-control-section">
        <LightRange label="Таазны өндөр" value={(design.height ?? 2.7) * 100} min={240} max={300} step={1} format={v => `${Math.round(v)} см`} onChange={v => onHeight(v / 100)} {...edit} />
        <MeasureInput label="Өндөр" value={(design.height ?? 2.7) * 100} min={240} max={300} onChange={v => onHeight(v / 100)} {...edit} />
        <h4>Таазны материал</h4><Swatches items={CEILING_MATERIALS} value={design.ceilingMaterial ?? "ceiling-white"} onChange={id => onUpdate({ ceilingMaterial: id })} />
        <p className="room-control-help">Дээрээс харахад тааз нуугдана. Камерыг таазнаас доош буулгахад эргэж харагдана.</p>
      </section>}
    </>}

    {tab === "openings" && <>
      <div className="room-panel-intro"><h3>Хаалга, цонх</h3><p>Загвараа ханан дээр чирэх эсвэл сонгоод хананд дарна уу.</p></div>
      <div className="room-control-section">
        <div className="room-opening-catalog">{OPENING_TEMPLATES.map(template => <div key={template.id} className="room-opening-card" data-active={placementTemplate === template.id}>
          <button draggable onDragStart={event => { event.dataTransfer.effectAllowed = "copy"; event.dataTransfer.setData("application/x-room-opening", template.id); event.dataTransfer.setData("text/plain", template.id); onArmPlacement(template.id); }}
            onClick={() => onArmPlacement(placementTemplate === template.id ? null : template.id)} aria-pressed={placementTemplate === template.id}>
            <span className={`room-opening-illustration ${template.kind} ${template.id.includes("double") ? "double" : ""}`}><i /><i /></span>
            <strong>{template.label}</strong><small>{Math.round(template.width * 100)} × {Math.round(template.height * 100)} см</small>
          </button>
          <button className="room-opening-quick-add" onClick={() => onAddOpening(template.id, selectedWall ?? placementWall)} aria-label={`${template.label} хананд нэмэх`}><Plus size={13} /> Хананд нэмэх</button>
        </div>)}</div>
        <label className="planner-number"><span>Нэмэх хана</span><select aria-label="Нэмэх хана" value={selectedWall ?? placementWall} onChange={event => { const id = event.target.value as RoomWall; setPlacementWall(id); onSelectWall(id); }}>
          {WALLS.map(id => <option key={id} value={id}>{ROOM_WALLS[id]}</option>)}</select></label>
        {placementTemplate && <div className="room-placement-instruction" role="status"><DoorOpen size={18} /><span>Байрлуулах ханандаа дарна уу.</span><button aria-label="Байрлуулахыг цуцлах" onClick={() => onArmPlacement(null)}><X size={16} /></button></div>}
      </div>

      {opening && <section className="room-control-section room-opening-inspector" key={opening.id}>
        <div className="room-section-heading"><h4>{OPENING_TEMPLATES.find(item => item.id === opening.templateId)?.label ?? (opening.kind === "door" ? "Хаалга" : "Цонх")}</h4>
          <button className="room-remove" aria-label="Сонгосон хаалга эсвэл цонхыг устгах" onClick={() => { onUpdate({ openings: design.openings!.filter(item => item.id !== opening.id) }); onSelectOpening(null); }}><Trash2 size={16} /></button></div>
        <label className="planner-number"><span>Байрлах хана</span><select value={opening.wallId} aria-label="Хаалга цонхны хана" onChange={event => onUpdateOpening({ ...opening, wallId: event.target.value as RoomWall })}>
          {WALLS.map(id => <option key={id} value={id}>{ROOM_WALLS[id]}</option>)}</select></label>
        <div className="room-field-pair">
          <MeasureInput label="Нээлхийн өргөн" value={opening.width * 100} min={30} max={wallLength(design, opening.wallId) * 100} onChange={v => onUpdateOpening({ ...opening, width: v / 100 })} {...edit} />
          <MeasureInput label="Нээлхийн өндөр" value={opening.height * 100} min={30} max={(design.height ?? 2.7) * 100} onChange={v => onUpdateOpening({ ...opening, height: v / 100 })} {...edit} />
        </div>
        <LightRange label="Ханын дагуух байрлал" value={opening.position * 100} min={0} max={100} step={0.5} format={v => `${v.toFixed(1)}%`} onChange={v => onUpdateOpening({ ...opening, position: v / 100 })} {...edit} />
        <p className="room-control-help">Булангаас төв хүртэл {(opening.position * wallLength(design, opening.wallId) * 100).toFixed(0)} см. Өрөөн дотор чирж шилжүүлж болно.</p>
        {opening.kind === "door" ? <>
          <div className="room-field-pair"><label className="planner-number"><span>Нугас</span><select aria-label="Хаалганы нугас" value={opening.hinge} onChange={event => onUpdateOpening({ ...opening, hinge: event.target.value as "left" | "right" })}><option value="left">Зүүн</option><option value="right">Баруун</option></select></label>
            <label className="planner-number"><span>Нээгдэх чиглэл</span><select aria-label="Хаалганы нээгдэх чиглэл" value={opening.swing} onChange={event => onUpdateOpening({ ...opening, swing: event.target.value as "inward" | "outward" })}><option value="inward">Дотогш</option><option value="outward">Гадагш</option></select></label></div>
          <button className="room-secondary-action" onClick={() => onUpdateOpening({ ...opening, open: !opening.open })}><DoorOpen size={16} />{opening.open ? "Хаалгыг хаах" : "Хаалгыг нээх"}</button>
        </> : <MeasureInput label="Шалнаас тавцан хүртэл" value={opening.sillHeight * 100} min={0} max={((design.height ?? 2.7) - opening.height) * 100} onChange={v => onUpdateOpening({ ...opening, sillHeight: v / 100 })} {...edit} />}
      </section>}
      <section className="room-control-section"><h4>Өрөөнд байрласан · {design.openings?.length ?? 0}</h4>
        {!design.openings?.length ? <p className="room-control-help">Дээрх загваруудаас анхны хаалга эсвэл цонхоо нэмээрэй.</p> : <div className="room-opening-list">{design.openings.map(item =>
          <button key={item.id} aria-pressed={item.id === selectedOpening} onClick={() => onSelectOpening(item.id)}><span>{OPENING_TEMPLATES.find(template => template.id === item.templateId)?.label ?? item.kind}<small>{ROOM_WALLS[item.wallId]} · {Math.round(item.width * 100)} × {Math.round(item.height * 100)} см</small></span><DoorOpen size={17} /></button>)}</div>}
      </section>
    </>}

    {tab === "lighting" && <>
      <div className="room-panel-intro"><h3>Өрөөний гэрэлтүүлэг</h3><p>Өдрийн болон оройн орчныг харьцуулж үзээрэй.</p></div>
      <section className="room-control-section">
        <div className="room-light-presets"><button aria-pressed={lighting.mode === "day"} onClick={() => updateLighting({ mode: "day", ambient: 0.65, sunlight: 1.8 })}><Sun size={23} /><strong>Өдөр</strong><small>Байгалийн гэрэл</small></button>
          <button aria-pressed={lighting.mode === "evening"} onClick={() => updateLighting({ mode: "evening", ambient: 0.22, sunlight: 0.12 })}><Moon size={23} /><strong>Орой</strong><small>Дулаан, зөөлөн</small></button></div>
        <LightRange label="Орчны гэрэл" value={lighting.ambient} max={1.5} onChange={ambient => updateLighting({ ambient })} {...edit} />
        <LightRange label="Нарны гэрэл" value={lighting.sunlight} max={3} onChange={sunlight => updateLighting({ sunlight })} {...edit} />
      </section>
      <section className="room-control-section"><div className="room-section-heading"><h4>Таазны гэрэл · {lighting.fixtures.length}</h4><Lightbulb size={18} /></div>
        <button className="room-secondary-action" disabled={lighting.fixtures.length >= 8} onClick={() => {
          const geometry = getRoomGeometry(design), bounds = geometry.bounds;
          let point: { x: number; z: number } | null = null;
          for (let iz = 1; iz < 12 && !point; iz++) for (let ix = 1; ix < 12; ix++) {
            const x = bounds.minX + (bounds.maxX - bounds.minX) * ix / 12, z = bounds.minZ + (bounds.maxZ - bounds.minZ) * iz / 12;
            if (!geometry.voids.some(rect => x >= rect.minX && x <= rect.maxX && z >= rect.minZ && z <= rect.maxZ) && !lighting.fixtures.some(f => Math.hypot(x - f.x, z - f.z) < 0.6)) { point = { x, z }; break; }
          }
          if (!point) { onNotice("Гэрэл нэмэх сул зай хүрэлцэхгүй байна."); return; }
          const center = { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 };
          if (!lighting.fixtures.length && !geometry.voids.some(rect => center.x >= rect.minX && center.x <= rect.maxX && center.z >= rect.minZ && center.z <= rect.maxZ)) point = center;
          updateLighting({ fixtures: [...lighting.fixtures, { id: crypto.randomUUID(), ...point, intensity: 18, color: "#ffe3b3" }] });
        }}><Plus size={16} /> Таазны гэрэл нэмэх</button>
        <p className="room-control-help">Гэрлийн байрлал, хүчийг доороос тохируулна. Нэг өрөөнд 8 хүртэл гэрэл нэмнэ.</p>
        {lighting.fixtures.map((fixture, index) => <div className="room-fixture" key={fixture.id}>
          <div className="room-section-heading"><strong>Гэрэл {index + 1}</strong><button className="room-remove" aria-label={`Гэрэл ${index + 1} устгах`} onClick={() => updateLighting({ fixtures: lighting.fixtures.filter(f => f.id !== fixture.id) })}><Trash2 size={15} /></button></div>
          <div className="room-field-pair">{(["x", "z"] as const).map(axis => <MeasureInput key={axis} label={axis === "x" ? "Зүүнээс зай" : "Арын хананаас зай"}
            value={(fixture[axis] + (axis === "x" ? design.width : design.depth) / 2) * 100} min={5} max={(axis === "x" ? design.width : design.depth) * 100 - 5}
            onChange={value => {
              const next = { ...fixture, [axis]: value / 100 - (axis === "x" ? design.width : design.depth) / 2 };
              const g = getRoomGeometry(design);
              if (next.x < g.bounds.minX + 0.05 || next.x > g.bounds.maxX - 0.05 || next.z < g.bounds.minZ + 0.05 || next.z > g.bounds.maxZ - 0.05 || g.voids.some(rect => next.x >= rect.minX && next.x <= rect.maxX && next.z >= rect.minZ && next.z <= rect.maxZ)) { onNotice("Гэрэл өрөөний таазны дотор байрлах ёстой."); return; }
              updateLighting({ fixtures: lighting.fixtures.map(f => f.id === fixture.id ? next : f) });
            }} {...edit} />)}</div>
          <LightRange label={`Гэрэл ${index + 1} хүч`} value={fixture.intensity} max={50} step={1} format={v => `${v}`} onChange={intensity => updateLighting({ fixtures: lighting.fixtures.map(f => f.id === fixture.id ? { ...f, intensity } : f) })} {...edit} />
          <label className="room-color-picker"><span>Гэрлийн өнгө</span><input type="color" aria-label={`Гэрэл ${index + 1} өнгө`} value={fixture.color} onFocus={beginEdit} onBlur={endEdit}
            onChange={event => updateLighting({ fixtures: lighting.fixtures.map(f => f.id === fixture.id ? { ...f, color: event.target.value } : f) })} /></label>
        </div>)}
      </section>
    </>}
  </div>;
}
