"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2, ArrowRight, ShoppingBag, ChevronRight, Truck, Check } from "lucide-react";
import { useCart } from "@/store/cart";
import { useCatalog } from "@/store/catalog";
import { formatPrice } from "@/lib/format";
import { FREE_SHIPPING_THRESHOLD, STANDARD_SHIPPING_FEE } from "@/lib/orders";

import { quantityLimit, stockLabel } from "@/lib/inventory";

export default function CartPage() {
  const { items, setQty, remove, subtotal } = useCart();
  const catalog = useCatalog();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const sub = subtotal();
  const shipping = !items.length || sub >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;
  const total = sub + shipping;
  const limitFor = (item: typeof items[number]) => {
    const product = catalog.products.find(p => p.id === item.productId);
    return product && catalog.ready ? quantityLimit(product, items, item, item.id) : 0;
  };
  const stockIssue = catalog.ready && items.some(item => item.qty > limitFor(item));
  if (!mounted) return <div className="shop-container py-16 text-center text-sm" role="status">Сагсыг ачаалж байна…</div>;
  if (!items.length) return <div className="shop-container py-10 sm:py-16"><div className="shop-empty"><ShoppingBag size={44} strokeWidth={1.3} /><h1>Таны сагс хоосон байна</h1><p>Гэртээ тохирох тавилгаа сонгоод сагсандаа нэмээрэй. Таны дараагийн дуртай тавилга энд бий.</p><Link href="/catalog" className="btn-primary">Тавилга үзэх <ArrowRight size={17} /></Link><Link href="/wishlist" className="text-link">Хадгалсан тавилгаа харах</Link></div></div>;
  return <div className="shop-container py-7 sm:py-10">
    <nav aria-label="Захиалгын алхмууд" className="checkout-steps"><span className="current" aria-current="step">01 · Сагс</span><ChevronRight size={13} /><span>02 · Хүргэлт</span><ChevronRight size={13} /><span>03 · Төлбөр</span></nav>
    <div className="section-title"><div><h1 className="text-3xl font-semibold tracking-tight">Таны сагс <span className="ml-2 text-lg font-normal text-[#7a8272]">({items.reduce((sum, i) => sum + i.qty, 0)})</span></h1><p className="mt-2 text-sm text-[#74806b]">Гэрийн тань шинэ өнгө төрхөд нэг алхам ойртлоо.</p></div><Link href="/catalog" className="text-link">Үргэлжлүүлэн үзэх <ArrowRight size={15} /></Link></div>
    <div className="cart-layout">
      <div className="min-w-0 space-y-4">
        <div className="shipping-progress"><div className="flex items-center gap-2">{shipping === 0 ? <Check size={17} /> : <Truck size={17} />}<span>{shipping === 0 ? "Таны захиалгын хүргэлт үнэгүй!" : "Үнэгүй хүргэлтэд " + formatPrice(Math.max(0, FREE_SHIPPING_THRESHOLD - sub)) + " дутуу байна."}</span></div><progress aria-label="Үнэгүй хүргэлтийн босго" max={FREE_SHIPPING_THRESHOLD} value={Math.min(sub, FREE_SHIPPING_THRESHOLD)} /></div>
        {catalog.error && <p role="alert" className="text-sm text-red-700">Үлдэгдэл ачаалсангүй. <button className="underline" onClick={() => void catalog.refresh()}>Дахин оролдох</button></p>}
        {items.map(i => <div key={i.id} className="cart-item">
          <Link href={"/product/" + i.productId} className="shrink-0"><Image src={i.image} alt={i.name} width={120} height={120} className="h-20 w-20 rounded-xl object-cover sm:h-28 sm:w-28" /></Link>
          <div className="cart-item-details">
            <div className="flex items-start justify-between gap-2"><div className="min-w-0"><Link href={"/product/" + i.productId} className="break-words text-sm font-medium">{i.name}</Link><p className="mt-1 text-xs capitalize text-[#74806b]">{catalog.products.find(p => p.id === i.productId)?.colors.find(c => c.id === i.color)?.name ?? i.color} · {catalog.products.find(p => p.id === i.productId)?.materials.find(m => m.id === i.material)?.name ?? ({ wood: "Мод", metal: "Металл", fabric: "Даавуу", leather: "Арьс", velvet: "Хилэн" })[i.material]}</p></div><button type="button" onClick={() => remove(i.id)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#849077] hover:bg-[#faf0eb] hover:text-[#ad6547]" aria-label={i.name + " сагснаас хасах"}><Trash2 size={16} /></button></div>
            <p className="mt-2 text-xs text-[#74806b]">{catalog.ready ? stockLabel(catalog.products.find(p => p.id === i.productId) ?? {stockQuantity: 0}) : "Үлдэгдэл шалгаж байна…"}</p>
            {catalog.ready && i.qty > limitFor(i) && <p role="alert" className="mt-2 text-xs text-red-700">Сонгосон тоо үлдэгдлээс их байна. Тоог бууруулах эсвэл сагснаас хасна уу.</p>}
            <div className="cart-item-bottom"><div className="flex items-center rounded-lg border border-[#e5e7df]" role="group" aria-label={i.name + " тоо ширхэг"}><button type="button" aria-label="Тоо ширхэг хасах" disabled={i.qty <= 1} onClick={() => setQty(i.id, i.qty - 1)} className="grid h-11 w-11 place-items-center disabled:opacity-30"><Minus size={14} /></button><span className="min-w-5 text-center text-sm tabular-nums">{i.qty}</span><button type="button" aria-label="Тоо ширхэг нэмэх" disabled={!catalog.ready || i.qty >= limitFor(i)} onClick={() => setQty(i.id, Math.min(limitFor(i), i.qty + 1))} className="grid h-11 w-11 place-items-center"><Plus size={14} /></button></div><strong className="text-sm tabular-nums sm:text-base">{formatPrice(i.unitPrice * i.qty)}</strong></div>
          </div>
        </div>)}
      </div>
      <aside className="cart-summary"><h2 className="text-lg font-semibold">Захиалгын дүн</h2><dl className="mt-6 space-y-4 text-sm"><div className="flex justify-between gap-3"><dt className="text-[#74806b]">Барааны дүн</dt><dd className="tabular-nums">{formatPrice(sub)}</dd></div><div className="flex justify-between gap-3"><dt className="text-[#74806b]">Хүргэлт</dt><dd className="tabular-nums">{shipping === 0 ? "Үнэгүй" : formatPrice(shipping)}</dd></div><div className="flex justify-between gap-3 border-t border-[#e5e7df] pt-5 text-base font-semibold"><dt>Нийт төлөх</dt><dd className="tabular-nums">{formatPrice(total)}</dd></div></dl>{catalog.ready && !stockIssue ? <Link href="/checkout" className="btn-primary mt-6 w-full">Захиалга үргэлжлүүлэх <ArrowRight size={17} /></Link> : <button disabled className="btn-primary mt-6 w-full opacity-50">{stockIssue ? "Сагсны тоо ширхэгээ засна уу" : "Үлдэгдэл шалгаж байна…"}</button>}<p className="mt-4 text-center text-xs leading-5 text-[#74806b]">Дараагийн алхамд хүргэлтийн хаягаа оруулна. Эцсийн үнэ, нөөцийг баталгаажуулна.</p></aside>
    </div>
  </div>;
}


