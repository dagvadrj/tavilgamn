"use client";
import { useState } from "react";
import Image from "next/image";
import type { Product } from "@/lib/types";
import { EXTRA_CATEGORIES, type KitchenExtra } from "@/lib/kitchenExtras";
import { DimensionInput } from "./PlannerPanels";
export function ExtrasPanel({ products, selected, room, disabled, error, loading, onAdd, onChange, onDelete, onDuplicate }: {
  products: Product[]; selected?: KitchenExtra; room: {width:number;depth:number}; disabled:boolean; error:string|null; loading:boolean;
  onAdd:(product:Product)=>void; onChange:(extra:KitchenExtra)=>void; onDelete:()=>void; onDuplicate:()=>void;
}) {
  const [tab,setTab]=useState<"dining"|"extra">("dining"),[query,setQuery]=useState("");
  const options=products.filter(p=>EXTRA_CATEGORIES.includes(p.category)&&((p.category==="dining-table")===(tab==="dining"))&&p.name.toLowerCase().includes(query.toLowerCase()));
  return <section className="kp-panel" aria-label="Dining болон нэмэлт тавилга">
    {selected ? <fieldset disabled={disabled} className="km-fields"><h2>{selected.name}</h2><p>{selected.width} × {selected.height} × {selected.depth} мм</p>
      <DimensionInput label="Нэмэлт тавилгын X" value={selected.position.x} min={0} max={room.width} onCommit={x=>onChange({...selected,position:{...selected.position,x}})}/>
      <DimensionInput label="Нэмэлт тавилгын Z" value={selected.position.z} min={0} max={room.depth} onCommit={z=>onChange({...selected,position:{...selected.position,z}})}/>
      <button type="button" onClick={()=>onChange({...selected,position:{...selected.position,rotation:selected.position.rotation+Math.PI/2}})}>Нэмэлт тавилгыг 90° эргүүлэх</button>
      {selected.model ? <p>GLB-ийн эх материал, өнгийг хадгална.</p> : <>
        <label>Нэмэлт тавилгын өнгө <input aria-label="Нэмэлт тавилгын өнгө" type="color" value={selected.color} onChange={e=>onChange({...selected,color:e.target.value})}/></label>
        <label>Нэмэлт тавилгын материал <select value={selected.material} onChange={e=>onChange({...selected,material:e.target.value as KitchenExtra['material']})}>
          {(['wood','metal','fabric','leather','velvet'] as const).map(material=><option key={material} value={material}>{material}</option>)}
        </select></label>
      </>}
      <button type="button" onClick={onDuplicate}>Нэмэлт тавилгыг хувилах</button><button type="button" onClick={onDelete}>Нэмэлт тавилгыг устгах</button>
    </fieldset> : <><h2>Dining / Extras каталог</h2><div role="group" aria-label="Нэмэлт каталогийн төрөл"><button type="button" aria-pressed={tab==="dining"} onClick={()=>setTab("dining")}>Хоолны ширээ</button><button type="button" aria-pressed={tab==="extra"} onClick={()=>setTab("extra")}>Нэмэлт тавилга</button></div>
      <label className="kp-field">Тавилга хайх <input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      {error ? <p role="alert">{error}</p> : loading ? <p role="status">Каталог ачаалж байна…</p> : !options.length ? <p>Энэ төрлийн бүтээгдэхүүн каталогт алга.</p> : null}
      <div className="km-extras-list">{options.map(product=><button type="button" key={product.id} disabled={disabled} aria-label={`Нэмэх: ${product.name}`} onClick={()=>onAdd(product)}>
        <Image src={product.image} alt="" width={76} height={56}/><span>{product.name}<small>{Math.round(product.dimensions.w*1000)} × {Math.round(product.dimensions.d*1000)} мм</small></span>
      </button>)}</div></>}
  </section>;
}
