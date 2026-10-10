"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Check, ChevronRight, DoorOpen, Droplets, Grid2X2, Minus, Plus, Ruler, Search, X } from "lucide-react";
import { DimensionInput, Plan } from "./PlannerPanels";
import { cabinetLabel, type KitchenRoom, type KitchenSpaceItem, type ModularKitchen } from "@/lib/kitchenCabinets";
import { parseKitchenSpace, resizeKitchenRoom, spaceItemCandidates } from "@/lib/kitchenSpace";
import { placementIssues } from "@/lib/kitchenPlacement";
import "./kitchen-space.css";

const TOOLS = [
  { id: "shape", label: "Өрөөний хэлбэр", Icon: Grid2X2 },
  { id: "size", label: "Хэмжээ тохируулах", Icon: Ruler },
  { id: "elements", label: "Багана", Icon: Box },
  { id: "openings", label: "Хаалга, цонх", Icon: DoorOpen },
  { id: "search", label: "Хайлт", Icon: Search },
  { id: "water", label: "Усны цэг", Icon: Droplets },
] as const;
const LABELS = { door: "Хаалга", window: "Цонх", column: "Багана", water: "Усны цэг" };

export function KitchenSpaceEditor({ kitchen, disabled, onChange, onClose, onReview, onSelectCabinet }: {
  kitchen: ModularKitchen; disabled: boolean; onChange: (next: ModularKitchen) => boolean; onClose: () => void; onReview: () => void; onSelectCabinet: (id: string) => void;
}) {
  const [tool, setTool] = useState<typeof TOOLS[number]["id"] | null>("size");
  const [zoom, setZoom] = useState(1);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [wall, setWall] = useState<KitchenSpaceItem["wall"]>("back");
  const [error, setError] = useState("");
  const dialog = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const closeAction = useRef(onClose);
  closeAction.current = onClose;
  const [fitZoom, setFitZoom] = useState(1);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = dialog.current;
    const controls = () => Array.from(root?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]') ?? []).filter(element => element.getClientRects().length);
    controls()[0]?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeAction.current(); }
      if (event.key === "Tab") {
        const elements = controls(), first = elements[0], last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    root?.addEventListener("keydown", close);
    return () => { root?.removeEventListener("keydown", close); previous?.isConnected && previous.focus(); };
  }, []);
  useEffect(() => {
    const root = canvas.current;
    if (!root) return;
    const observer = new ResizeObserver(([entry]) => {
      const ratio = (kitchen.room.depth + 400) / (kitchen.room.width + 450);
      const fit = Math.min(1.4, Math.max(0.3, Math.min((entry.contentRect.width - 48) / 620, (entry.contentRect.height - 48) / (620 * ratio))));
      setFitZoom(fit); setZoom(fit);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [kitchen.room.width, kitchen.room.depth]);
  const room = kitchen.room;
  const items = room.items ?? [];
  const selectedItem = items.find(item => item.id === selected);
  function updateRoom(nextRoom: KitchenRoom) {
    if (disabled) return false;
    try { parseKitchenSpace(nextRoom); } catch (reason) { setError((reason as Error).message); return false; }
    const issue = placementIssues({ ...kitchen, room: nextRoom }).find(item => item.severity === "error");
    if (issue) { setError(issue.message); return false; }
    if (onChange({ ...kitchen, room: nextRoom })) { setError(""); return true; }
    setError("Өөрчлөлтийг хадгалж чадсангүй. Дахин оролдоорой.");
    return false;
  }
  function resize(patch: Partial<Pick<KitchenRoom, "width" | "depth" | "height">>) {
    try { updateRoom(resizeKitchenRoom(room, patch)); } catch (reason) { setError((reason as Error).message); }
  }
  function add(kind: KitchenSpaceItem["kind"]) {
    for (const item of spaceItemCandidates(room, kind, wall, crypto.randomUUID())) {
      const next = { ...room, items: [...items, item] };
      try { parseKitchenSpace(next); } catch { continue; }
      if (placementIssues({ ...kitchen, room: next }).some(issue => issue.severity === "error")) continue;
      if (updateRoom(next)) setSelected(item.id);
      return;
    }
    setError("Нэмэх сул зай олдсонгүй. Хана эсвэл өрөөний хэмжээгээ өөрчлөөрэй.");
  }
  function changeItem(patch: Partial<KitchenSpaceItem>) {
    updateRoom({ ...room, items: items.map(item => item.id === selected ? { ...item, ...patch } : item) });
  }
  const matches = (name: string) => name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  return <section ref={dialog} className="kspace" role="dialog" aria-modal="true" aria-label="Өрөөгөө тохируулах">
    <header className="kspace-header"><strong>tavilga.mn</strong><nav aria-label="Гал тогоо төлөвлөх үе шат"><span aria-current="step">1. Өрөөгөө тохируулах</span><button type="button" onClick={onClose}>2. Гарнитураа засах</button><button type="button" onClick={onReview}>3. Шалгаж хадгалах</button></nav><button type="button" aria-label="Өрөөний төлөвлөгөөг хаах" onClick={onClose}><X size={21}/></button></header>
    <div className="kspace-toolbar"><div className="kspace-tools">{TOOLS.map(({ id, label, Icon }) => <button key={id} type="button" aria-pressed={tool === id} onClick={() => { setTool(tool === id ? null : id); setSelected(null); setError(""); }}><Icon size={25}/><span>{label}</span></button>)}</div><DimensionInput unit="см" label="Таазны өндөр" value={room.height} min={2200} max={3500} disabled={disabled} onCommit={height => resize({ height })}/><button type="button" className="kspace-continue" onClick={onClose}>Үргэлжлүүлэх <ChevronRight size={17}/></button></div>
    <div className="kspace-workspace">
      {tool && <aside className="kspace-panel"><div className="kspace-panel-title"><h2>{TOOLS.find(item => item.id === tool)?.label}</h2><button type="button" aria-label="Хэрэгслийг хаах" onClick={() => setTool(null)}><X size={18}/></button></div>
        <div className="kspace-room-summary"><span>ТАНЫ ӨРӨӨ</span><strong>{(room.width * room.depth / 1000000).toFixed(1)} <small>м²</small></strong><p>{room.width / 1000} × {room.depth / 1000} м · {items.length} элемент</p></div>
        {tool === "shape" && <><p>Өрөөнийхөө ханын хэлбэрийг сонгоорой.</p><div className="kspace-shapes">{[{ label: "Хаалттай өрөө", openFront: false }, { label: "Урд тал нээлттэй", openFront: true }].map(shape => <button key={shape.label} type="button" disabled={disabled} aria-pressed={Boolean(room.openFront) === shape.openFront} onClick={() => updateRoom({ ...room, openFront: shape.openFront })}><svg viewBox="0 0 100 100" aria-hidden="true"><path d="M15 85V15h70v70" fill="#f0e6d6" stroke="#536c5e" strokeWidth="4"/><path d="M15 85h70" stroke="#536c5e" strokeWidth="4" strokeDasharray={shape.openFront ? "5 5" : undefined}/></svg>{shape.label}{Boolean(room.openFront) === shape.openFront && <Check size={16}/>}</button>)}</div></>}
        {tool === "size" && <><p>Хэмжээг сантиметрээр оруулаад Enter дараарай. Жишээ: 3.5 м = 350 см.</p><DimensionInput unit="см" label="Өргөн" value={room.width} min={2000} max={8000} disabled={disabled} onCommit={width => resize({ width })}/><DimensionInput unit="см" label="Урт" value={room.depth} min={2000} max={8000} disabled={disabled} onCommit={depth => resize({ depth })}/></>}
        {tool === "elements" && <><p>Баганыг нэмж, байрлал болон хэмжээг нь тохируулаарай.</p><button className="kspace-add" type="button" disabled={disabled} onClick={() => add("column")}><Plus size={18}/> Багана нэмэх</button></>}
        {tool === "openings" && <><p>Хаалга, цонхны байрлалыг 2D төлөвлөгөөнд тэмдэглэнэ.</p><label>Хана<select value={wall} onChange={event => setWall(event.target.value as KitchenSpaceItem["wall"])}><option value="back">Арын хана</option><option value="left">Зүүн хана</option><option value="right">Баруун хана</option>{!room.openFront && <option value="front">Урд хана</option>}</select></label><button className="kspace-add" type="button" disabled={disabled} onClick={() => add("door")}><Plus size={18}/> Хаалга нэмэх</button><button className="kspace-add" type="button" disabled={disabled} onClick={() => add("window")}><Plus size={18}/> Цонх нэмэх</button></>}
        {tool === "water" && <><p>Усны холболтын цэгийг 2D төлөвлөгөөнд тэмдэглэж, угаалтууртайгаа тааруулаарай.</p><button className="kspace-add" type="button" disabled={disabled} onClick={() => add("water")}><Plus size={18}/> Усны цэг нэмэх</button></>}
        {tool === "search" && <><label>Төлөвлөгөөн дотроос хайх<input autoFocus type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Шүүгээ, хаалга, усны цэг…"/></label>{kitchen.cabinets.filter(c => matches(cabinetLabel(c))).map(c => <button type="button" key={c.id} className="kspace-result" onClick={() => { onSelectCabinet(c.id); onClose(); }}>{cabinetLabel(c)} · {c.width / 10} см <ChevronRight size={15}/></button>)}{items.filter(item => matches(LABELS[item.kind])).map(item => <button type="button" className="kspace-result" key={item.id} onClick={() => setSelected(item.id)}>{LABELS[item.kind]} · {item.width / 10} см</button>)}{!kitchen.cabinets.some(c => matches(cabinetLabel(c))) && !items.some(item => matches(LABELS[item.kind])) && <p>Тохирох зүйл олдсонгүй.</p>}</>}
        {tool !== "search" && items.filter(item => tool === "elements" ? item.kind === "column" : tool === "openings" ? ["door", "window"].includes(item.kind) : tool === "water" ? item.kind === "water" : false).map(item => <button className="kspace-result" key={item.id} type="button" aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>{LABELS[item.kind]} · {item.width / 10} см</button>)}
        {selectedItem && <fieldset disabled={disabled}><legend>{LABELS[selectedItem.kind]}</legend><DimensionInput unit="см" label="Өргөн" value={selectedItem.width} min={50} max={3000} onCommit={width => changeItem({ width })}/>{["column", "water"].includes(selectedItem.kind) ? <><DimensionInput unit="см" label="Зүүн хананаас" value={selectedItem.x} min={0} max={room.width} onCommit={x => changeItem({ x })}/><DimensionInput unit="см" label="Арын хананаас" value={selectedItem.z} min={0} max={room.depth} onCommit={z => changeItem({ z })}/>{selectedItem.kind === "column" && <DimensionInput unit="см" label="Гүн" value={selectedItem.depth} min={50} max={3000} onCommit={depth => changeItem({ depth })}/>}</> : <DimensionInput unit="см" label="Хананы эхнээс төв хүртэл" value={["back", "front"].includes(selectedItem.wall) ? selectedItem.x : selectedItem.z} min={0} max={["back", "front"].includes(selectedItem.wall) ? room.width : room.depth} onCommit={value => changeItem(["back", "front"].includes(selectedItem.wall) ? { x: value } : { z: value })}/>}<button type="button" className="kspace-delete" onClick={() => { if (updateRoom({ ...room, items: items.filter(item => item.id !== selected) })) setSelected(null); }}>Устгах</button></fieldset>}
        {error && <p className="kspace-error" role="alert">{error}</p>}
      </aside>}
      <div ref={canvas} className="kspace-canvas"><div className="kspace-plan" style={{ width: `${Math.round(620 * zoom)}px` }}>
        <Plan unit="см" kitchen={kitchen} selectedId={null} onSelect={id => { onSelectCabinet(id); onClose(); }}/>
        <svg className="kspace-overlay" viewBox={`-200 -200 ${room.width + 450} ${room.depth + 400}`} aria-label="Өрөөний элементүүд">
          <text x={room.width / 2} y={room.depth / 2 + 100} textAnchor="middle" fontSize="130" fill="#39473e">Миний гал тогоо</text><text x={room.width / 2} y={room.depth / 2 + 300} textAnchor="middle" fontSize="100" fill="#667468">{(room.width * room.depth / 1000000).toFixed(1)} м²</text>
          {room.openFront && <><path d={`M0 ${room.depth}H${room.width}`} stroke="white" strokeWidth="20" vectorEffect="non-scaling-stroke"/><path d={`M0 ${room.depth}H${room.width}`} stroke="#839184" strokeWidth="15" strokeDasharray="60 40"/></>}
          {items.map(item => <g key={item.id} transform={`translate(${item.x} ${item.z}) rotate(${["left", "right"].includes(item.wall) && ["door", "window"].includes(item.kind) ? 90 : 0})`} role="button" tabIndex={0} aria-label={LABELS[item.kind]} className={selected === item.id ? "is-selected" : ""} onClick={() => { setTool(item.kind === "column" ? "elements" : item.kind === "water" ? "water" : "openings"); setSelected(item.id); }} onKeyDown={event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); setTool(item.kind === "column" ? "elements" : item.kind === "water" ? "water" : "openings"); setSelected(item.id); } }}>
            {item.kind === "column" && <rect x={-item.width / 2} y={-item.depth / 2} width={item.width} height={item.depth} fill="#b3b9b3" stroke="#5e6f62" strokeWidth="15"/>}
            {item.kind === "water" && <><circle r="100" fill="#e0f4fb" stroke="#2789b4" strokeWidth="18"/><text textAnchor="middle" y="45" fontSize="130" fill="#2789b4">У</text></>}
            {item.kind === "window" && <><rect x={-item.width / 2} y="-45" width={item.width} height="90" fill="#dbeefa" stroke="#688c9d" strokeWidth="12"/><path d={`M${-item.width / 2} 0H${item.width / 2}`} stroke="#688c9d" strokeWidth="10"/></>}
            {item.kind === "door" && <><rect x={-item.width / 2} y="-30" width={item.width} height="60" fill="white"/><path d={`M${-item.width / 2} 0v${item.width} M${-item.width / 2} ${item.width}a${item.width} ${item.width} 0 0 0 ${item.width} ${-item.width}`} fill="none" stroke="#8c9a8e" strokeWidth="14"/></>}
          </g>)}
        </svg>
      </div></div>
      <div className="kspace-zoom"><button type="button" aria-label="Томруулах" disabled={zoom >= 2.4} onClick={() => setZoom(value => Math.min(2.4, value + 0.2))}><Plus size={18}/></button><button type="button" aria-label="Жижигрүүлэх" disabled={zoom <= 0.3} onClick={() => setZoom(value => Math.max(0.3, value - 0.2))}><Minus size={18}/></button><button type="button" title="Өрөөг бүтнээр харах" onClick={() => setZoom(fitZoom)}>Бүтнээр</button></div>
    </div><footer className="kspace-footer"><span><Grid2X2 size={18}/> Дээрээс харах · 2D</span><button type="button" onClick={onClose}><Box size={18}/> 3D харах</button><small>Шүүгээн дээр дарж тохируулна · Хэмжээ: см</small></footer>
  </section>;
}
