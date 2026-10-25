"use client";
import Image from "next/image";
import type { Product } from "@/lib/types";
import { PCMALL_APPLIANCES, PCMALL_PRODUCTS, pcmallSourceUrl } from "@/lib/pcmallAppliances";

export function PcmallApplianceLibrary({ disabled, onAdd, query = "" }: { disabled: boolean; onAdd: (product: Product) => void; query?: string }) {
  const items = PCMALL_APPLIANCES.filter(item => `${item.label} ${item.name} ${item.model}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <section className="kitchen-supplier-library" aria-label="PC Mall цахилгаан төхөөрөмжүүд">
    <header><h3>PC Mall · 7 төхөөрөмж</h3><p>Бодит зураг, хэмжээс · Хялбаршуулсан 3D загвар</p></header>
    <p className="kitchen-supplier-note">Суурилуулдаг төхөөрөмж өөрийн сул зайд байрлана. Боксыг орлуулах, тавцанд огтлол гаргахгүй.</p>
    <div className="kitchen-supplier-grid">{items.map(item => <article className="kitchen-supplier-card" key={item.id}>
      <Image src={`/models/pcmall/${item.imageFile}`} alt={item.name} width={220} height={160} />
      <div className="kitchen-supplier-card-content"><span>{item.label}</span><h4>{item.name}</h4>
        <p>{item.width} × {item.depth} × {item.height} мм <small>Өргөн × Гүн × Өндөр</small></p>
        <p>{item.installation === "integrated" ? "Суурилуулдаг" : item.planningPlacement === "wall" ? "Хананд" : item.planningPlacement === "countertop" ? "Тавцан дээр" : "Шалан дээр"}</p>
        <p className="kitchen-supplier-price">{new Intl.NumberFormat("mn-MN").format(item.price)} ₮ <small>PC Mall · 2026-10-24-ний лавлах үнэ</small></p>
        {!item.inStock && <p className="kitchen-supplier-stock">Эх дэлгүүрт үлдэгдэлгүй · төлөвлөх боломжтой</p>}
        <button type="button" className="planner-primary-button" disabled={disabled} aria-label={`${item.label} — ${item.model} нэмэх`} onClick={() => onAdd(PCMALL_PRODUCTS.find(product => product.model?.id === item.id)!)}>Зурагт нэмэх</button>
        <a href={pcmallSourceUrl(item)} target="_blank" rel="noreferrer">PC Mall дээр үзэх ↗</a>
      </div>
    </article>)}</div>
    {!items.length && <p className="planner-empty">Хайлтад тохирох төхөөрөмж олдсонгүй.</p>}
  </section>;
}
