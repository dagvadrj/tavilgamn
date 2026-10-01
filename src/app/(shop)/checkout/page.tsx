"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/store/auth";
import { requestGuestCartTransfer, useCart } from "@/store/cart";
import { useCatalogStore } from "@/store/catalog";
import { authFetch } from "@/lib/authFetch";
import { formatPrice } from "@/lib/format";
import type { DeliveryAddress, OrderQuote, OrderRecord } from "@/lib/orders";

export default function CheckoutPage() {
  const router = useRouter();
  const user = useAuth((state) => state.user);
  const initialized = useAuth((state) => state.initialized);
  const items = useCart((state) => state.items);
  const [delivery, setDelivery] = useState<DeliveryAddress>({ name: "", phone: "", address: "" });
  const [quote, setQuote] = useState<{ signature: string; userId: string; value: OrderQuote } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const submitting = useRef(false);
  const attempt = useRef<{ signature: string; id: string } | null>(null);
  const selections = items.map(({ productId, color, material, qty }) => ({ productId, color, material, qty }));
  const signature = JSON.stringify(selections);
  const currentQuote = quote?.signature === signature && quote.userId === user?.id ? quote.value : null;
  useEffect(() => { setQuote(null); setError(null); setCreated(null); }, [user?.id]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || submitting.current) return;
    submitting.current = true;
    setBusy(true); setError(null);
    const ownerId = user.id;
    try {
      if (!currentQuote) {
        const response = await authFetch("/api/orders/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: selections }) }, ownerId);
        const result = await response.json();
        if (!response.ok) {
        void useCatalogStore.getState().refresh(true); void useCatalogStore.getState().refresh(true); throw new Error(result.error ?? "Үнийг шалгаж чадсангүй."); }
        if (useAuth.getState().user?.id === ownerId) setQuote({ signature, userId: ownerId, value: result });
        return;
      }
      const payload = { items: selections, delivery, expectedTotal: currentQuote.total };
      const requestSignature = JSON.stringify(payload);
      const storageKey = `casa-checkout-attempt-${ownerId}`;
      try {
        const previous = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
        if (previous?.signature === requestSignature && typeof previous.id === "string") attempt.current = previous;
      } catch { /* In-memory retry still works when browser storage is unavailable. */ }
      if (attempt.current?.signature !== requestSignature) attempt.current = { signature: requestSignature, id: crypto.randomUUID() };
      try { sessionStorage.setItem(storageKey, JSON.stringify(attempt.current)); } catch { /* Storage is optional. */ }
      const response = await authFetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, idempotencyKey: attempt.current.id }) }, ownerId);
      const result = await response.json();
      if (!response.ok) {
        if (result.code === "PRICE_CHANGED" && useAuth.getState().user?.id === ownerId) {
          setQuote({ signature, userId: ownerId, value: result.quote });
        }
        throw new Error(result.error ?? "Захиалга үүсгэж чадсангүй.");
      }
      const order = result as OrderRecord;
      if (useAuth.getState().user?.id !== ownerId) return;
      // Remove only quantities submitted by this checkout; preserve later additions.
      useCart.setState((state) => ({ items: state.items.map((item) => {
        const bought = selections.find((line) => line.productId === item.productId && line.color === item.color && line.material === item.material);
        return bought ? { ...item, qty: item.qty - bought.qty } : item;
      }).filter((item) => item.qty > 0) }));
      try { sessionStorage.removeItem(storageKey); } catch { /* Storage is optional. */ }
      attempt.current = null;
      void useCatalogStore.getState().refresh(true);
      setCreated(order.id);
      router.push(`/orders/${order.id}`);
    } catch (err) {
      if (useAuth.getState().user?.id === ownerId) setError(err instanceof Error ? err.message : "Сүлжээний алдаа гарлаа. Дахин оролдоно уу.");
    } finally { submitting.current = false; setBusy(false); }
  }

  if (!initialized) return <p className="p-12 text-center">Ачаалж байна…</p>;
  if (!user) return <div className="mx-auto max-w-lg p-12 text-center"><h1 className="text-3xl">Захиалга өгөхийн тулд нэвтэрнэ үү</h1><p className="my-4">Сагсны бараануудыг таны бүртгэлд нэмээд захиалгыг үргэлжлүүлнэ.</p><Link className="btn-primary" href="/login?next=/checkout" onClick={requestGuestCartTransfer}>Нэвтрээд үргэлжлүүлэх</Link></div>;
  if (created) return <div className="p-12 text-center"><p>Захиалга бүртгэгдлээ.</p><Link className="underline" href={`/orders/${created}`}>Төлбөрийн сонголт руу очих</Link></div>;
  if (!items.length) return <div className="p-12 text-center"><p>Сагс хоосон байна.</p><Link className="underline" href="/catalog">Каталог үзэх</Link></div>;
  return <div className="shop-container checkout-shell py-8 sm:py-12">
    <nav aria-label="Захиалгын алхмууд" className="checkout-steps"><Link href="/cart">01 · Сагс</Link><ChevronRight size={13} /><span className="current" aria-current="step">02 · Хүргэлт</span><ChevronRight size={13} /><span>03 · Төлбөр</span></nav>
    <Link href="/cart" className="text-sm underline">Сагс руу буцах</Link>
    <h1 className="mt-4 text-3xl font-semibold tracking-tight">Захиалга баталгаажуулах</h1>
    <form onSubmit={submit} className="mt-8 grid gap-8 md:grid-cols-2">
      <fieldset disabled={busy} className="min-w-0 space-y-4 rounded-2xl border border-[#e5e7df] bg-white p-5 sm:p-7">
        <legend className="mb-4 text-xl">Хүргэлтийн мэдээлэл</legend>
        <label className="block text-sm">Хүлээн авагчийн нэр<input className="input mt-2" autoComplete="name" required minLength={2} maxLength={100} value={delivery.name} onChange={(e) => setDelivery({ ...delivery, name: e.target.value })} /></label>
        <label className="block text-sm">Утас<input className="input mt-2" type="tel" autoComplete="tel" required minLength={8} maxLength={24} value={delivery.phone} onChange={(e) => setDelivery({ ...delivery, phone: e.target.value })} /></label>
        <label className="block text-sm">Хүргэлтийн хаяг<textarea className="input mt-2" autoComplete="street-address" rows={4} required minLength={10} maxLength={500} placeholder="Хот, дүүрэг, хороо, байр, тоот" value={delivery.address} onChange={(e) => setDelivery({ ...delivery, address: e.target.value })} /></label>
      </fieldset>
      <section className="rounded-lg border border-[#293C32]/15 bg-[#FFFFFF] p-6">
        <h2 className="text-xl">Захиалгын дүн</h2>
        {currentQuote ? <>
          <ul className="my-4 space-y-3">{currentQuote.items.map((item) => <li key={JSON.stringify([item.productId, item.color, item.material])} className="text-sm"><p>{item.name} × {item.qty}</p>{item.stockQuantity != null && <p className="text-xs text-[#42634f]">Шалгах үеийн үлдэгдэл: {item.stockQuantity} ширхэг</p>}<p className="text-[#6C726B]">{item.colorName} · {item.materialName}</p><p>{formatPrice(item.lineTotal)}</p></li>)}</ul>
          <p className="flex justify-between text-sm"><span>Хүргэлт</span><span>{currentQuote.shipping === 0 ? "Үнэгүй" : formatPrice(currentQuote.shipping)}</span></p>
          <p className="mt-4 flex justify-between font-semibold"><span>Нийт</span><span>{formatPrice(currentQuote.total)}</span></p>
        </> : <p className="my-4 text-sm text-[#6C726B]">Хүргэлтийн мэдээллээ оруулаад барааны одоогийн үнэ, нөөцтэй эсэхийг шалгана уу.</p>}
        {error && <p role="alert" className="my-4 text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="btn-primary mt-6 w-full disabled:opacity-50">{busy ? "Шалгаж байна…" : currentQuote ? "Захиалга үүсгэж, төлбөр рүү шилжих" : "Үнэ шалгах"}</button>
        <p className="mt-3 text-xs text-[#6C726B]">Дараагийн алхамд QPay, SocialPay эсвэл банкны шилжүүлэг сонгоно.</p>
      </section>
    </form>
  </div>;
}

