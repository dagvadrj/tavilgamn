"use client";
import dynamic from "next/dynamic";
import { useMemo, useRef, useState, type PointerEvent } from "react";
import type { RoomDesign, RoomShape, RoomSurfaces } from "@/lib/types";
import { getRoomGeometry, roomPath } from "@/lib/roomGeometry";
import { ROOM_TEMPLATES, type RoomTemplate } from "@/lib/roomPolygon";
import { BUILDER_STAGES, builderInteraction, chooseRoomTemplate, createRoomBuilderDraft, resizeRoomBuilder, transformRoomBuilder, validateRoomBuilder, type RoomBuilderDraft } from "@/lib/roomBuilderDraft";
import { createOpening, OPENING_TEMPLATES } from "@/lib/roomOpenings";
import { FLOOR_MATERIALS } from "@/lib/roomMaterials";
import { OpeningQuickEditor } from "./OpeningQuickEditor";
import "./room-builder.css";
const RoomCanvas = dynamic(() => import("@/three/RoomCanvas").then(m => m.RoomCanvas), { ssr: false });
export function RoomBuilder({ initial, onComplete, onCancel }: {
    initial: RoomShape & Partial<RoomSurfaces & {
        wallColor: string;
        floorColor: string;
    }>;
    onComplete: (draft: RoomBuilderDraft) => string | null;
    onCancel: () => void;
}) {
    const [draft, setDraft] = useState(() => { const draft = createRoomBuilderDraft(initial); return !draft.outline && !draft.wallFeatures?.length && !draft.columns?.length && !draft.openings?.length ? chooseRoomTemplate(draft, "rectangle") : draft; });
    const [stage, setStage] = useState(0), [ceiling, setCeiling] = useState(false);
    const [error, setError] = useState(""), [selected, setSelected] = useState(0);
    const [unit, setUnit] = useState<"cm" | "ft">("cm");
    const [past, setPast] = useState<RoomBuilderDraft[]>([]), [future, setFuture] = useState<RoomBuilderDraft[]>([]);
    const gesture = useRef<{
        pointer: number;
        index: number;
        matrix: DOMMatrix;
        before: RoomBuilderDraft;
    } | null>(null);
    const latest = useRef(draft);
    latest.current = draft;
    const geometry = useMemo(() => getRoomGeometry(draft), [draft]);
    const mode = builderInteraction(stage, ceiling);
    const preview = useMemo(() => ({ ...draft, id: "room-builder-preview", name: "Өрөөний ноорог", size: "80", pieces: [], createdAt: 0, updatedAt: 0 }) as RoomDesign, [draft]);
    function change(next: RoomBuilderDraft, history = true) {
        const issue = validateRoomBuilder(next);
        if (issue) {
            setError(issue);
            return false;
        }
        if (JSON.stringify(next) === JSON.stringify(latest.current)) {
            setError("");
            return true;
        }
        if (history) {
            setPast(p => [...p, structuredClone(latest.current)].slice(-60));
            setFuture([]);
        }
        latest.current = next;
        setDraft(next);
        setError("");
        return true;
    }
    const measure = (label: string, value: number, update: (value: number) => boolean) => {
        if (unit === "cm")
            return <label>{label} (см)<input key={`${label}-${value}-cm`} type="number" defaultValue={Number((value * 100).toFixed(2))} step="0.1" min="5" onBlur={e => { const number = Number(e.target.value) / 100; if (Number.isFinite(number) && number !== value) {
                if (!update(number))
                    e.currentTarget.value = String(Number((value * 100).toFixed(2)));
            } }}/></label>;
        const totalInches = Math.round(value / .0254 * 100) / 100, feet = Math.floor(totalInches / 12), inches = Number((totalInches - feet * 12).toFixed(2));
        return <fieldset className="room-builder-history"><legend>{label} · фут, инч</legend><label>Фут<input key={`${label}-${value}-feet`} type="number" min="0" step="1" defaultValue={feet} onBlur={e => { const n = Number(e.target.value); if (!Number.isFinite(n) || n < 0 || !update((n * 12 + inches) * .0254))
            e.currentTarget.value = String(feet); }}/></label><label>Инч<input key={`${label}-${value}-inches`} type="number" min="0" max="11.99" step=".1" defaultValue={inches} onBlur={e => { const n = Number(e.target.value); if (!Number.isFinite(n) || n < 0 || n >= 12 || !update((feet * 12 + n) * .0254))
            e.currentTarget.value = String(inches); }}/></label></fieldset>;
    };
    function finishGesture(event: PointerEvent<SVGSVGElement>, cancel = false) {
        const active = gesture.current;
        if (!active || active.pointer !== event.pointerId)
            return;
        gesture.current = null;
        if (cancel) {
            latest.current = active.before;
            setDraft(active.before);
        }
        else if (JSON.stringify(active.before) !== JSON.stringify(latest.current)) {
            setPast(p => [...p, active.before].slice(-60));
            setFuture([]);
        }
        if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const points = draft.outline;
    const walls = geometry.segments.filter(s => !s.hole);
    return <section className="room-builder" aria-label="Дөрвөн алхамтай өрөө байгуулагч">
    <aside className="room-builder-panel">
      <ol>{BUILDER_STAGES.map((label, i) => <li key={label}><button type="button" aria-current={stage === i ? "step" : undefined} onClick={() => { setStage(i); setCeiling(false); }}>{i + 1}. {label}</button></li>)}</ol>
      <div className="room-builder-history"><button type="button" disabled={!past.length} onClick={() => { setFuture(f => [draft, ...f]); setDraft(past.at(-1)!); setPast(p => p.slice(0, -1)); }}>↶ Буцаах</button><button type="button" disabled={!future.length} onClick={() => { setPast(p => [...p, draft]); setDraft(future[0]); setFuture(f => f.slice(1)); }}>↷ Дахин хийх</button></div>
      {stage === 0 && <><h2>Өрөөний хэлбэр</h2><p>Хэлбэр солиход нээлхий болон хана, шалны өнгө шинэчлэгдэнэ.</p><div className="room-builder-templates">{(Object.keys(ROOM_TEMPLATES) as RoomTemplate[]).map(key => <button type="button" key={key} onClick={() => { change(chooseRoomTemplate(draft, key)); setSelected(0); }}><svg viewBox="-5 -5 110 110" aria-hidden="true"><polygon points={ROOM_TEMPLATES[key].points.map(([x, z]) => `${x * 100},${z * 100}`).join(" ")}/></svg>{ROOM_TEMPLATES[key].label}</button>)}</div></>}
      {stage === 1 && <><h2>Өрөөний хэмжээ</h2><div className="room-builder-history"><button type="button" aria-pressed={!ceiling} onClick={() => setCeiling(false)}>Шалны план</button><button type="button" aria-pressed={ceiling} onClick={() => setCeiling(true)}>Таазны өндөр</button></div><label>Хэмжих нэгж<select value={unit} onChange={e => setUnit(e.target.value as typeof unit)}><option value="cm">Сантиметр</option><option value="ft">Фут, инч</option></select></label>
        {ceiling ? measure("Таазны өндөр", draft.height, height => change({ ...draft, height })) : <>{measure("Өргөн", draft.width, width => change(resizeRoomBuilder(draft, width, draft.depth)))}{measure("Урт", draft.depth, depth => change(resizeRoomBuilder(draft, draft.width, depth)))}
          <label>Ханын хэсэг<select value={selected} onChange={e => setSelected(Number(e.target.value))}>{walls.map((s, i) => <option key={s.id ?? i} value={i}>Хана {i + 1} · {(s.length * 100).toFixed(1)} см</option>)}</select></label>
          {points && points[selected] && measure("Ханын урт", walls[selected].length, length => { const a = points[selected], b = points[(selected + 1) % points.length], ratio = length / walls[selected].length; return change({ ...draft, outline: points.map((p, i) => i === (selected + 1) % points.length ? { ...p, x: a.x + (b.x - a.x) * ratio, z: a.z + (b.z - a.z) * ratio } : p) }); })}
          <button type="button" onClick={() => {
                    if (!points)
                        return;
                    const next = [...points], a = points[selected], b = points[(selected + 1) % points.length], segmentId = crypto.randomUUID();
                    next.splice(selected + 1, 0, { id: crypto.randomUUID(), segmentId, x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
                    const openings = draft.openings?.map(o => o.segmentId === a.segmentId ? { ...o, segmentId: o.position <= .5 ? a.segmentId : segmentId, position: o.position <= .5 ? o.position * 2 : (o.position - .5) * 2 } : o);
                    change({ ...draft, outline: next, openings });
                }}>Хананд цэг нэмэх</button>
          <button type="button" disabled={!points || points.length <= 3} onClick={() => { if (!points)
                return; if (change({ ...draft, outline: points.filter((_, i) => i !== selected) }))
                setSelected(0); }}>Сонгосон цэг устгах</button>
          <p>Цэгүүдийг чирж хэлбэрээ өөрчилнө. Хэмжээг батлахад хананууд огтлолцвол өмнөх зөв хэлбэр үлдэнэ.</p>
        </>}
        <div className="room-builder-history">{(["flip-x", "flip-z", "rotate"] as const).map((id, i) => <button key={id} type="button" onClick={() => { try {
            change(transformRoomBuilder(draft, id));
        }
        catch (reason) {
            setError((reason as Error).message);
        } }}>{["Хэвтээ эргүүлэх", "Босоо эргүүлэх", "90° эргүүлэх"][i]}</button>)}</div>
      </>}
      {stage === 2 && <><h2>Хаалга, цонх</h2><label>Байрлуулах хана<select value={selected} onChange={e => setSelected(Number(e.target.value))}>{walls.map((wall, i) => <option key={wall.id ?? i} value={i}>Хана {i + 1} · {(wall.length * 100).toFixed()} см</option>)}</select></label><div className="room-builder-history">{OPENING_TEMPLATES.map(template => <button key={template.id} type="button" onClick={() => {
                    const wall = walls[selected];
                    if (!wall)
                        return;
                    const cardinal = Math.abs(wall.nx) > .5 ? wall.nx > 0 ? "west" : "east" : wall.nz > 0 ? "north" : "south";
                    const opening = { ...createOpening(template.id, cardinal), ...(wall.id ? { segmentId: wall.id } : {}) };
                    for (const position of [.5, .25, .75, .15, .85]) {
                        const next = { ...draft, openings: [...(draft.openings ?? []), { ...opening, position }] };
                        if (!validateRoomBuilder(next)) {
                            change(next);
                            return;
                        }
                    }
                    setError("Энэ хананд сонгосон хаалга, цонх багтахгүй байна.");
                }}>+ {template.label}</button>)}</div>{draft.openings?.map(opening => <OpeningQuickEditor key={opening.id} opening={opening} room={draft} onChange={next => change({ ...draft, openings: draft.openings?.map(o => o.id === next.id ? next : o) })} beginEdit={() => { }} endEdit={() => { }} onRemove={() => change({ ...draft, openings: draft.openings?.filter(o => o.id !== opening.id) })}/>)}</>}
      {stage === 3 && <><h2>Хана, шалны өнгө</h2><label>Ханын өнгө<input type="color" value={draft.wallColor} onChange={e => change({ ...draft, wallColor: e.target.value, wallMaterials: {} })}/></label><label>Шалны материал<select value={draft.floorMaterial} onChange={e => change({ ...draft, floorMaterial: e.target.value })}>{FLOOR_MATERIALS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label><label>Шалны өнгө<input type="color" value={draft.floorColor} onChange={e => change({ ...draft, floorColor: e.target.value, floorMaterial: "legacy" })}/></label></>}
      {error && <p role="alert" className="room-builder-error">{error}</p>}
      <footer><button type="button" onClick={onCancel}>Болих</button><button type="button" onClick={() => { if (stage > 0) {
        setStage(stage - 1);
        setCeiling(false);
    }
    else
        onCancel(); }}>Буцах</button><button type="button" onClick={() => { const issue = validateRoomBuilder(draft); if (issue) {
        setError(issue);
        return;
    } if (stage < 3) {
        setStage(stage + 1);
        setCeiling(false);
    }
    else
        setError(onComplete(structuredClone(draft)) ?? ""); }}>{stage === 3 ? "Батлах" : "Үргэлжлүүлэх"}</button></footer>
    </aside>
    <div className="room-builder-preview" data-camera={mode.view} data-orbit={mode.orbit} data-wall-editing={mode.wallEditing}>
      {mode.view === "plan" ? <svg viewBox={`${-draft.width / 2 - .5} ${-draft.depth / 2 - .5} ${draft.width + 1} ${draft.depth + 1}`} aria-label="Өрөөний шугаман план" style={{ touchAction: "none" }} onPointerMove={e => {
                const drag = gesture.current;
                if (!drag || drag.pointer !== e.pointerId)
                    return;
                const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(drag.matrix);
                change({ ...drag.before, outline: drag.before.outline?.map((v, i) => i === drag.index ? { ...v, x: Math.round(p.x * 1000) / 1000, z: Math.round(p.y * 1000) / 1000 } : v) }, false);
            }} onPointerUp={e => finishGesture(e)} onPointerCancel={e => finishGesture(e, true)} onLostPointerCapture={e => finishGesture(e, true)}>
        <path d={roomPath(draft)} fill={draft.floorColor} stroke="#526859" strokeWidth={.025}/>
        {walls.map((s, i) => <text key={s.id ?? i} x={(s.a.x + s.b.x) / 2} y={(s.a.z + s.b.z) / 2 - .08} fontSize={.11} textAnchor="middle">{(s.length * 100).toFixed(1)} см</text>)}
        {mode.wallEditing && points?.map((p, i) => <circle key={p.id} cx={p.x} cy={p.z} r={.07} fill={i === selected ? "#0058a3" : "white"} stroke="#0058a3" strokeWidth={.02} role="button" tabIndex={0} aria-label={`Өрөөний цэг ${i + 1}`} onKeyDown={e => { if (e.key === "Enter" || e.key === " ")
                setSelected(i); }} onPointerDown={e => {
                    if (e.button !== 0)
                        return;
                    const svg = e.currentTarget.ownerSVGElement, matrix = svg?.getScreenCTM()?.inverse();
                    if (!svg || !matrix)
                        return;
                    e.preventDefault();
                    setSelected(i);
                    gesture.current = { pointer: e.pointerId, index: i, matrix, before: structuredClone(draft) };
                    svg.setPointerCapture(e.pointerId);
                }}/>)}
      </svg> : <RoomCanvas design={preview} view="perspective" selected={null} onSelect={() => { }} onMove={() => { }} locked={false} snapEnabled={false} onUpdateOpening={mode.openingEditing ? opening => change({ ...draft, openings: draft.openings?.map(o => o.id === opening.id ? opening : o) }) : undefined}/>}
      <p>{geometry.area.toFixed(2)} м² · {mode.view === "plan" ? "Дээрээс харах" : "3D харагдац"}</p>
    </div>
  </section>;
}
