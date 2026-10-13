"use client";

import { Plus, Trash2 } from "lucide-react";
import { KITCHEN_PART_KINDS, type KitchenGlbAssembly, type KitchenGlbOption, type KitchenGlbSlot, type KitchenPartKind, type KitchenPartVector } from "@/lib/kitchenGlbAssembly";
import type { KitchenModelCandidate } from "@/lib/kitchenModuleCatalog";
import dynamic from "next/dynamic";
const AssemblyPreview = dynamic(() => import("./AdminKitchenAssemblyPreview"), { ssr: false });

export const PART_LABELS: Record<KitchenPartKind, string> = {
  door: "Хаалга", "drawer-front": "Шургуулгын нүүр", handle: "Бариул", countertop: "Тавцан", legs: "Хөл / суурь", "cover-panel": "Хажуу хавтан", filler: "Завсар нөхөгч", frame: "Их бие", shelf: "Тавиур", drawer: "Шургуулга", appliance: "Цахилгаан хэрэгсэл", accessory: "Дагалдах эд анги",
};
const freshSlot = (index: number): KitchenGlbSlot => ({ id: `part-${index}`, label: "Хаалга", kind: "door", positionMm: [0, 0, 0], rotationDeg: [0, 0, 0], scale: [1, 1, 1], hideNodes: [], optional: false, defaultOptionId: "", options: [] });

function VectorFields({ label, value, onChange, step = 1 }: { label: string; value: KitchenPartVector; onChange: (value: KitchenPartVector) => void; step?: number }) {
  return <fieldset className="min-w-0"><legend className="mb-1 text-xs text-black/60">{label}</legend><div className="flex gap-1">{value.map((n, i) => <label key={i} className="min-w-0 flex-1 text-xs">{["X", "Y", "Z"][i]}<input className="input mt-1 w-full !px-2" type="number" value={n} step={step} onChange={event => { const next = [...value] as KitchenPartVector; next[i] = Number(event.target.value); onChange(next); }} /></label>)}</div></fieldset>;
}

export default function AdminKitchenAssemblyEditor({ value, onChange, models, baseModel }: {
  value: KitchenGlbAssembly | null; onChange: (value: KitchenGlbAssembly | null) => void; models: KitchenModelCandidate[]; baseModel?: KitchenModelCandidate;
}) {
  const slots = value?.slots ?? [];
  const changeSlot = (id: string, patch: Partial<KitchenGlbSlot>) => onChange({ version: 1, ...value, slots: slots.map(slot => slot.id === id ? { ...slot, ...patch } : slot) });
  const changeOption = (slot: KitchenGlbSlot, id: string, patch: Partial<KitchenGlbOption>) => changeSlot(slot.id, { options: slot.options.map(option => option.id === id ? { ...option, ...patch } : option) });
  const addSlot = () => { let index = slots.length + 1; while (slots.some(slot => slot.id === `part-${index}`)) index++; onChange({ version: 1, ...value, slots: [...slots, freshSlot(index)] }); };
  return <section className="space-y-3 rounded-xl border border-black/10 bg-white p-4 md:col-span-2 xl:col-span-4" aria-label="GLB эд ангийн тохиргоо">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">Солих эд анги · Style / Color</h3><p className="mt-1 max-w-3xl text-xs leading-5 text-black/60">Их биеийн GLB нэг удаа байрлана. Хаалга, бариул зэрэг солигдох хэсэгт slot үүсгээд, өнгө / загвар бүрийн GLB-г холбоно. Нэг GLB-г олон шүүгээнд дахин ашиглаж болно.</p></div><button type="button" className="btn-ghost" onClick={addSlot} disabled={slots.length >= 32}><Plus size={14} />Эд анги нэмэх</button></div>
    {!slots.length && <p className="rounded-lg bg-black/[0.03] p-3 text-xs text-black/55">Одоогоор бүтэн GLB ашиглана. Солих хэсэгтэй бол «Эд анги нэмэх» дарна уу.</p>}
    {baseModel?.glbReady && baseModel.glbFile && <AssemblyPreview assembly={value} models={models} baseModel={baseModel}/>}
    {slots.map((slot, index) => {
      const parent = slots.find(parent => parent.id === slot.parentSlotId);
      const parentModels = parent ? parent.options.map(option => models.find(model => model.id === option.modelId)) : [baseModel];
      const nodes = [...new Set(parentModels.flatMap(model => model?.nodeNames ?? []))];
      const choices = models.filter(model => model.glbReady && model.id !== baseModel?.id && (!model.partKind || model.partKind === slot.kind));
      return <article key={slot.id} className="space-y-3 rounded-lg border border-black/15 p-3">
        <div className="flex items-center justify-between gap-2"><strong className="text-sm">{index + 1}. {slot.label || "Эд анги"} <span className="font-normal text-black/40">· {slot.id}</span></strong><button type="button" aria-label={`${slot.label} эд анги устгах`} className="btn-ghost !min-h-8 !px-2 text-red-600" onClick={() => onChange({ version: 1, ...value, slots: slots.filter(item => item.id !== slot.id).map(item => item.parentSlotId === slot.id ? { ...item, parentSlotId: undefined } : item) })}><Trash2 size={14} /></button></div>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="label">Төрөл<select className="input mt-1 w-full" value={slot.kind} onChange={event => changeSlot(slot.id, { kind: event.target.value as KitchenPartKind, label: PART_LABELS[event.target.value as KitchenPartKind] })}>{KITCHEN_PART_KINDS.map(kind => <option key={kind} value={kind}>{PART_LABELS[kind]}</option>)}</select></label>
          <label className="label">Хэрэглэгчид харагдах нэр<input className="input mt-1 w-full" value={slot.label} maxLength={120} onChange={event => changeSlot(slot.id, { label: event.target.value })} /></label>
          <label className="label">Юунд бэхлэх вэ?<select className="input mt-1 w-full" value={slot.parentSlotId ?? ""} onChange={event => changeSlot(slot.id, { parentSlotId: event.target.value || undefined })}><option value="">Шүүгээний үндсэн GLB</option>{slots.filter(item => item.id !== slot.id).map(item => <option key={item.id} value={item.id}>{item.label} · {item.id}</option>)}</select><small className="text-black/50">Бариулыг хаалганд холбоход хамт нээгдэнэ.</small></label>
          <label className="label">Холбох node / anchor<input className="input mt-1 w-full" list={`anchors-${slot.id}`} value={slot.anchorNode ?? ""} placeholder="Ж: anchor_door_left" maxLength={128} onChange={event => changeSlot(slot.id, { anchorNode: event.target.value || undefined })} /><datalist id={`anchors-${slot.id}`}>{nodes.map(node => <option key={node} value={node} />)}</datalist><small className="text-black/50">Хоосон бол доорх X / Y / Z байрлалыг ашиглана.</small></label>
          <VectorFields label="Холболтоос шилжүүлэх · мм" value={slot.positionMm} onChange={positionMm => changeSlot(slot.id, { positionMm })} />
          <VectorFields label="Эргэлт · градус" value={slot.rotationDeg} onChange={rotationDeg => changeSlot(slot.id, { rotationDeg })} />
          <label className="label md:col-span-2">Үндсэн GLB дотор нуух хэсгүүд<input className="input mt-1 w-full" value={slot.hideNodes.join(", ")} placeholder="Ж: door_left, old_handle_left" onChange={event => changeSlot(slot.id, { hideNodes: event.target.value.split(",").map(value => value.trim()).filter(Boolean) })} /><small className="text-black/50">Солигдох хаалга үндсэн GLB-д хамт экспортлогдсон бол node нэрүүдийг таслалаар бичнэ.</small></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={slot.optional} onChange={event => changeSlot(slot.id, { optional: event.target.checked, defaultOptionId: !event.target.checked && !slot.defaultOptionId ? slot.options[0]?.id ?? "" : slot.defaultOptionId })} />Хэрэглэгч салгаж болно</label>
        </div>
        <details className="rounded-lg bg-black/[0.03] p-3"><summary className="cursor-pointer text-xs font-medium">Нээх хөдөлгөөн ба нарийвчилсан байрлал</summary><div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="label">Хөдөлгөөн<select className="input mt-1 w-full" value={slot.motion?.type ?? ""} onChange={event => changeSlot(slot.id, { motion: event.target.value ? { type: event.target.value as "hinge" | "slide", axis: event.target.value === "hinge" ? "y" : "z", amount: event.target.value === "hinge" ? -100 : 400, pivotMm: [0, 0, 0] } : undefined })}><option value="">Хөдөлгөөнгүй</option><option value="hinge">Нугасаар эргэх</option><option value="slide">Шургуулга татах</option></select></label>
          {slot.motion && <><label className="label">Тэнхлэг<select className="input mt-1 w-full" value={slot.motion.axis} onChange={event => changeSlot(slot.id, { motion: { ...slot.motion!, axis: event.target.value as "x" | "y" | "z" } })}>{["x", "y", "z"].map(axis => <option key={axis} value={axis}>{axis.toUpperCase()}</option>)}</select></label><label className="label">Нээх хэмжээ · {slot.motion.type === "hinge" ? "градус" : "мм"}<input className="input mt-1 w-full" type="number" value={slot.motion.amount} onChange={event => changeSlot(slot.id, { motion: { ...slot.motion!, amount: Number(event.target.value) } })} /></label><VectorFields label="Нугасны цэг · мм" value={slot.motion.pivotMm ?? [0, 0, 0]} onChange={pivotMm => changeSlot(slot.id, { motion: { ...slot.motion!, pivotMm } })} /></>}
          <VectorFields label="Scale · анхдагч 1 / 1 / 1" value={slot.scale} step={0.01} onChange={scale => changeSlot(slot.id, { scale })} />
        </div></details>
        <div className="space-y-2"><div className="flex items-center justify-between"><h4 className="text-sm font-medium">Загвар / өнгөний GLB сонголтууд</h4><button type="button" className="btn-ghost !min-h-8 text-xs" disabled={slot.options.length >= 40} onClick={() => { let n = slot.options.length + 1; while (slot.options.some(option => option.id === `option-${n}`)) n++; const id = `option-${n}`; changeSlot(slot.id, { options: [...slot.options, { id, label: "Шинэ сонголт", modelId: "" }], defaultOptionId: slot.defaultOptionId || id }); }}><Plus size={13} />Сонголт нэмэх</button></div>
          {slot.options.map(option => <div key={option.id} className="grid gap-2 rounded-lg bg-black/[0.03] p-3 md:grid-cols-4">
            <label className="label md:col-span-2">GLB файл<select className="input mt-1 w-full" required value={option.modelId} onChange={event => { const model = models.find(model => model.id === event.target.value); changeOption(slot, option.id, { modelId: event.target.value, label: model?.name ?? option.label, sizeMm: model ? { width: model.widthMm, height: model.heightMm, depth: model.depthMm } : undefined }); }}><option value="">Бэлэн GLB сонгох</option>{choices.map(model => <option key={model.id} value={model.id}>{model.name} · {model.widthMm}×{model.heightMm}×{model.depthMm} мм</option>)}</select></label>
            <label className="label">Загвар<input className="input mt-1 w-full" value={option.style ?? ""} maxLength={80} placeholder="Ж: Shaker" onChange={event => changeOption(slot, option.id, { style: event.target.value || undefined })} /></label>
            <label className="label">Өнгө<input className="input mt-1 w-full" value={option.color ?? ""} maxLength={80} placeholder="Ж: Матт цагаан" onChange={event => changeOption(slot, option.id, { color: event.target.value || undefined })} /></label>
            <label className="label md:col-span-2">Сонголтын нэр<input className="input mt-1 w-full" value={option.label} maxLength={120} onChange={event => changeOption(slot, option.id, { label: event.target.value })} /></label>
            <label className="flex items-center gap-2 text-xs"><input type="radio" name={`default-${slot.id}`} checked={slot.defaultOptionId === option.id} onChange={() => changeSlot(slot.id, { defaultOptionId: option.id })} />Үндсэн сонголт</label>
            <button type="button" className="btn-ghost self-end !min-h-8 text-xs text-red-600" onClick={() => { const options = slot.options.filter(item => item.id !== option.id); changeSlot(slot.id, { options, defaultOptionId: slot.defaultOptionId === option.id ? options[0]?.id ?? "" : slot.defaultOptionId }); }}><Trash2 size={13} />Сонголт устгах</button>
            <details className="md:col-span-4"><summary className="cursor-pointer text-xs text-black/60">Энэ GLB-ийн холболтыг нарийвчлах</summary><div className="mt-2 grid gap-3 md:grid-cols-2"><VectorFields label="GLB origin-ий зөрүү · мм" value={option.offsetMm ?? [0, 0, 0]} onChange={offsetMm => changeOption(slot, option.id, { offsetMm })} /><VectorFields label="GLB эргэлт · градус" value={option.rotationDeg ?? [0, 0, 0]} onChange={rotationDeg => changeOption(slot, option.id, { rotationDeg })} /></div></details>
          </div>)}
          {!slot.options.length && <p className="text-xs text-amber-700">Хадгалахаас өмнө дор хаяж нэг GLB сонголт холбоно уу.</p>}
        </div>
      </article>;
    })}
  </section>;
}
