"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Check, ChevronLeft, X } from "lucide-react";
import type { ModularKitchen } from "@/lib/kitchenCabinets";
import { kitchenVariantFits, type KitchenCatalogVariant, type KitchenCatalogModule } from "@/lib/kitchenModuleCatalog";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import type { KitchenMaterialDefinition } from "@/lib/kitchenMaterials";
import { kitchenDesignSuggestionResult, kitchenSuggestionMetrics, LAYOUT_LABELS, SUGGESTION_GOALS, type KitchenSuggestion, type SuggestionGoal } from "@/lib/kitchenDesignSuggestions";
import { Plan } from "./PlannerPanels";
import "./kitchen-design-suggestions.css";

const Scene = dynamic(() => import("@/three/ModularKitchenScene").then(m=>m.ModularKitchenScene),{ssr:false,loading:()=> <p role="status">3D харагдац ачаалж байна…</p>});
const cm = (n:number|null) => n===null ? "—" : `${Math.round(n/10).toLocaleString("mn-MN")} см`;
function Metrics({suggestion,original}:{suggestion:KitchenSuggestion;original:ReturnType<typeof kitchenSuggestionMetrics>}) {
  const m=suggestion.metrics;
  const delta = (next:number|null, previous:number|null) => next===null||previous===null||Math.abs(next-previous)<10 ? "Өөрчлөлтгүй" : `${next>previous?"+":"−"}${cm(Math.abs(next-previous))}`;
  return <dl className="suggestion-metrics">
    <div><dt>Төхөөрөмжийн шулуун зайн нийлбэр</dt><dd>{cm(m.workflow)}</dd><small>{delta(m.workflow,original.workflow)}</small></div>
    <div><dt>Залгаа бэлтгэх тавцан</dt><dd>{cm(m.prep)}</dd><small>{delta(m.prep,original.prep)}</small></div>
    <div><dt>Урд талын дундаж сул зай ≈</dt><dd>{cm(m.space)}</dd><small>{delta(m.space,original.space)}</small></div>
    <div><dt>Зөөх шүүгээ</dt><dd>{m.moved} ширхэг</dd><small>{m.moved===0?"Одоогийн байрлал":"Төрөл, хэмжээг хадгална"}</small></div>
    <div><dt>Шүүгээний гадна эзлэхүүн</dt><dd>{Math.round(m.storage)} л</dd><small>Доторх бодит багтаамж биш</small></div>
    <div><dt>Бүтээгдэхүүний дүн</dt><dd>{m.price === null ? "Үнэ дутуу" : formatPrice(m.price)}</dd><small>{m.changedProducts} бүтээгдэхүүн солигдоно</small></div>
  </dl>;
}
function Preview({suggestion,disabled,variantModels,materialDefinitions,onClose,onApply}:{
  suggestion:KitchenSuggestion;disabled:boolean;variantModels?:Record<string,KitchenCatalogVariant>;materialDefinitions?:Record<string,KitchenMaterialDefinition>;
  onClose:()=>void;onApply:()=>void;
}){
  const ref=useRef<HTMLDialogElement>(null);
  const missing=suggestion.design.cabinets.filter(c=>!(["refrigerator","hood","oven"].includes(c.opening??"")) &&
    !(variantModels?.[c.variantId??""]?.glbFile && kitchenVariantFits(variantModels[c.variantId??""],c))).length;
  useEffect(()=>{const dialog=ref.current;dialog?.showModal();return()=>dialog?.close();},[]);
  return <dialog ref={ref} className="suggestion-preview-dialog" aria-labelledby="suggestion-preview-title" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <header><div><small>{LAYOUT_LABELS[suggestion.layout]}</small><h2 id="suggestion-preview-title">{suggestion.title}</h2></div><button type="button" aria-label="3D харагдац хаах" onClick={onClose}><X size={20}/></button></header>
    <div className="suggestion-preview-scene"><Scene kitchen={suggestion.design} selectedId={null} mode="orbit" variantModels={variantModels} materialDefinitions={materialDefinitions}
      onSelect={()=>{}} onStart={()=>{}} onMove={()=>{}} onEnd={()=>{}} onCancel={()=>{}} /></div>
    <footer><p>Чирж эргүүлэн хараарай. {missing>0&&`${missing} шүүгээний 3D загвар сонгогдоогүй тул бүрэн байрлалыг 2D планаас харна уу.`}</p><button type="button" className="suggestion-primary" disabled={disabled} onClick={onApply}>Энэ хувилбарыг ашиглах</button></footer>
  </dialog>;
}
export function KitchenDesignSuggestions({ kitchen, disabled, onApply, onBack, onFinish, variantModels, materialDefinitions, modules = [], products = [] }: {
  kitchen: ModularKitchen; disabled: boolean; variantModels?:Record<string,KitchenCatalogVariant>;materialDefinitions?:Record<string,KitchenMaterialDefinition>;
  modules?: KitchenCatalogModule[]; products?: Product[];
  onApply: (next: ModularKitchen) => boolean; onBack: () => void; onFinish: () => void;
}) {
  const [error,setError]=useState("");
  const [goal,setGoal]=useState<SuggestionGoal>("balanced");
  const [lockAppliances,setLockAppliances]=useState(false);
  const [useCatalog,setUseCatalog]=useState(false);
  const [budget,setBudget]=useState("");
  const [style,setStyle]=useState("");
  const styles = useMemo(() => [...new Set(modules.flatMap(m => m.variants.flatMap(v => typeof v.configuration.style === "string" ? [v.configuration.style] : [])))].sort(), [modules]);
  const preferences = useMemo(() => ({ goal, lockAppliances, useCatalog, modules, products,
    ...(budget.trim() && Number.isFinite(Number(budget)) && Number(budget) > 0 ? { budget: Number(budget) } : {}),
    ...(style ? { style } : {}) }), [goal, lockAppliances, useCatalog, modules, products, budget, style]);
  const [preview,setPreview]=useState<KitchenSuggestion|null>(null);
  const result=useMemo(()=>kitchenDesignSuggestionResult(kitchen,preferences),[kitchen,preferences]);
  const original=useMemo(()=>kitchenSuggestionMetrics(kitchen,kitchen,preferences),[kitchen,preferences]);
  const apply=(suggestion:KitchenSuggestion)=>{
    if(disabled)return;
    if(onApply(structuredClone(suggestion.design))){setError("");setPreview(null);onBack();}
    else {setPreview(null);setError("Байрлалыг ашиглаж чадсангүй. Өрөөний хэмжээ, саадыг шалгаад дахин оролдоорой.");}
  };
  const selectedGoal=SUGGESTION_GOALS.find(g=>g.id===goal)!;
  return <section className="kitchen-suggestions" aria-label="Гал тогооны саналууд">
    <header className="suggestion-heading"><div><p className="suggestion-eyebrow">АЛХАМ 6 / 7 · БАЙРЛАЛЫН СОНГОЛТ</p><h1>Таны гал тогоонд тохирох {result.suggestions.length} санал</h1>
      <p>{useCatalog ? "Каталогийн бэлэн тавилгаас төсөв ба хадгалалтын хувилбаруудыг тооцно. Төхөөрөмжүүдийг солихгүй." : "Одоогийн тавилгаа хадгалж, байрлалыг харьцуулна."} Өнгө сольсон ижил байрлалыг давтахгүй.</p></div>
      <button type="button" onClick={onBack}><ChevronLeft size={16}/> Өөрөө тохижуулах</button></header>
    <section className="suggestion-preferences" aria-label="Саналын зорилго">
      <h2>Танд юу хамгийн чухал вэ?</h2>
      <div className="suggestion-goals" role="group" aria-label="Эрэмбэлэх зорилго">{SUGGESTION_GOALS.map(g=><button type="button" key={g.id} aria-pressed={g.id===goal} disabled={disabled} onClick={()=>setGoal(g.id)}>{g.title}</button>)}</div>
      <p>{selectedGoal.description}</p>
      <label className="suggestion-lock"><input type="checkbox" checked={lockAppliances} disabled={disabled} onChange={e=>setLockAppliances(e.target.checked)}/> Угаалтуур, плитка, сорогч, хөргөгчийн байрлалыг хадгалах</label>
      <label className="suggestion-lock"><input type="checkbox" checked={useCatalog} disabled={disabled || !modules.length} onChange={e=>setUseCatalog(e.target.checked)}/> Каталогийн өөр шүүгээнүүдийг санал болгох</label>
      <div className="suggestion-catalog-preferences">
        <label>Бүтээгдэхүүний төсөв · ₮<input type="number" min="1" step="10000" inputMode="numeric" placeholder="Хязгааргүй" value={budget} disabled={disabled} onChange={e=>setBudget(e.target.value)}/></label>
        {styles.length > 0 && <label>Каталогийн хэв маяг<select value={style} disabled={disabled} onChange={e=>setStyle(e.target.value)}><option value="">Бүгд</option>{styles.map(s=><option key={s} value={s}>{s}</option>)}</select></label>}
      </div>
      <p>Төсөв нь тавилгын үнэд хамаарна. Тавцан, суурилуулалт, хүргэлтийн дүнг тусад нь тодруулна.</p>
    </section>
    <p className="suggestion-result-count" role="status"><Check size={16}/> {result.checked} ялгаатай байрлал шалгаж, {result.valid} боломжит хувилбараас {result.suggestions.length}-ыг сонголоо.</p>
    {result.suggestions.length<5 && <p className="suggestion-explanation">{result.suggestions.length ? "Өрөө, одоогийн шүүгээ болон сонгосон нөхцөлд таван давхардалгүй, давуу талтай хувилбар олдсонгүй. Давхардсан, багтахгүй, харьцуулалтаар давуу талгүй хувилбаруудыг хассан." : "Одоогийн нөхцөлд ашиглаж болох хувилбар олдсонгүй. Өрөөний план, шүүгээний байрлал эсвэл төхөөрөмж түгжих сонголтоо шалгаарай."}
      {result.rejected.placement>0 && ` ${result.rejected.placement} байрлал хэмжээ, давхцлын шалгалтаар хасагдсан.`}
      {result.rejected.windows>0 && ` ${result.rejected.windows} байрлал хаалга эсвэл цонх хааж байсан.`}
      {result.rejected.locked>0 && ` ${result.rejected.locked} байрлал түгжсэн төхөөрөмжийг зөөж байсан.`}</p>}
    {(result.rejected.budget > 0 || result.rejected.unpriced > 0 || result.rejected.style > 0 || result.rejected.stock > 0) && <p className="suggestion-explanation" role="status">Төсөв хэтэрсэн: {result.rejected.budget} · Үнэ дутуу: {result.rejected.unpriced} · Хэв маяг тохироогүй: {result.rejected.style} · Нөөц хүрэлцээгүй: {result.rejected.stock}. Нөхцөлөө өөрчилж боломжит сонголтыг харна уу.</p>}
    <div className="kitchen-suggestion-grid">{result.suggestions.map((suggestion,index)=><article key={suggestion.id}>
      <div className="suggestion-card-heading"><span className="suggestion-number">{index+1}</span><div><h2>{suggestion.title}</h2><p>{LAYOUT_LABELS[suggestion.layout]}{suggestion.current?" · Одоогийн байрлал":""}</p></div>{index===0&&<span className="suggestion-recommended">Таны зорилгоор эхэнд</span>}</div>
      <div className="suggestion-plan"><Plan kitchen={suggestion.design} selectedId={null} onSelect={()=>{}} readOnly unit="см" showMeasurements={false}/></div>
      <Metrics suggestion={suggestion} original={original}/>
      <p className="suggestion-service">{suggestion.reason}</p>
      <p className="suggestion-service">Үнэтэй мөрүүдийн дэд дүн: {formatPrice(suggestion.metrics.knownSubtotal)} · Үнэ тодруулах мөр: {suggestion.metrics.unpriced}.</p>
      {suggestion.metrics.services!==null&&<p className="suggestion-service">Холболтын цэгүүд хүртэлх шулуун зайн нийлбэр ≈ {cm(suggestion.metrics.services)}. Суурилуулалтын тооцоо биш.</p>}
      {suggestion.warnings.length>0&&<ul className="suggestion-warnings">{suggestion.warnings.map((warning,i)=><li key={i}>{warning}</li>)}</ul>}
      <div className="suggestion-card-actions"><button type="button" onClick={()=>setPreview(suggestion)}><Box size={16}/> 3D дээр харах</button><button type="button" className="suggestion-primary" disabled={disabled} onClick={()=>apply(suggestion)}>Ашиглах</button></div>
    </article>)}</div>
    <p className="suggestion-footnote">Төхөөрөмжийн зайг төвүүдийн хооронд шулуунаар тооцсон. Урд талын зай нь төв шугам дагуух ойролцоо хэмжилт. Эзлэхүүнийг шүүгээний гадна хэмжээгээр тооцсон. Үнэ дутуу мөрүүдийг 0 төгрөгөөр тооцож нийт үнэ гэж харуулахгүй.</p>
    {error&&<p role="alert" className="suggestion-error">{error}</p>}
    <footer><button type="button" onClick={onBack}>Байрлалаа өөрөө засах</button><button type="button" disabled={disabled} onClick={onFinish}>Одоогийн загвараар дуусгах →</button></footer>
    {preview&&<Preview suggestion={preview} disabled={disabled} variantModels={variantModels} materialDefinitions={materialDefinitions} onClose={()=>setPreview(null)} onApply={()=>apply(preview)}/>}
  </section>;
}
