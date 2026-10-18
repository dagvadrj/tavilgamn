"use client";

import { PageSkeleton } from "@/components/PageSkeleton";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/store/auth";
import { requestGuestCartTransfer, useCart } from "@/store/cart";
import { useCatalogStore } from "@/store/catalog";
import { authFetch } from "@/lib/authFetch";
import { formatPrice } from "@/lib/format";
import type { DeliveryAddress, OrderRecord } from "@/lib/orders";
import { useCheckoutQuote } from "@/components/useCheckoutQuote";

export default function CheckoutPage() {
  const user = useAuth((state) => state.user);
  const initialized = useAuth((state) => state.initialized);
  if (!initialized) return <PageSkeleton variant="form" />;
  if (!user) return <div className="ui-empty"><h1>Захиалга өгөхийн тулд нэвтэрнэ үү</h1><p>Сагсны бараануудыг таны бүртгэлд нэмээд захиалгыг үргэлжлүүлнэ.</p><Link className="btn-primary" href="/login?next=/checkout" onClick={requestGuestCartTransfer}>Нэвтрээд үргэлжлүүлэх</Link></div>;
  return <CheckoutForm key={user.id} ownerId={user.id} />;
}

function CheckoutForm({ ownerId }: { ownerId: string }) {
  const router = useRouter();
  const items = useCart((state) => state.items);
  const [delivery, setDelivery] = useState<DeliveryAddress>({ name: "", phone: "", address: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [priceChange, setPriceChange] = useState<{ signature: string; before: number; after: number } | null>(null);
  const mounted = useRef(true);
  const submitting = useRef(false);
  const attempt = useRef<{ signature: string; id: string } | null>(null);
  const selections = items.map(({ productId, color, material, qty }) => ({ productId, color, material, qty }));
  const signature = JSON.stringify(selections);
  const currentCart = useRef(signature);
  const { quote: currentQuote, error: quoteError, loading: quoteLoading, retryQuote, acceptPriceChange } = useCheckoutQuote(ownerId, signature);
  const changedPrice = priceChange?.signature === signature ? priceChange : null;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { currentCart.current = signature; setError(null); setPriceChange(null); }, [signature]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (useAuth.getState().user?.id !== ownerId || submitting.current || !currentQuote || quoteLoading) return;
    submitting.current = true;
    setBusy(true); setError(null);
    try {
      let payload = { items: selections, delivery, expectedTotal: currentQuote.total };
      const storageKey = `casa-checkout-attempt-${ownerId}`;
      try {
        const previous = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
        if (typeof previous?.signature === "string" && typeof previous.id === "string") attempt.current = previous;
      } catch { /* In-memory retry still works when browser storage is unavailable. */ }
      try {
        const previous = JSON.parse(attempt.current?.signature ?? "null");
        if (previous && Number.isSafeInteger(previous.expectedTotal) && previous.expectedTotal >= 0 &&
          JSON.stringify([previous.items, previous.delivery]) === JSON.stringify([selections, delivery])) {
          // A refreshed quote must not turn an uncertain request into a second
          // order. Replay its original payload; the server checks the key first.
          payload = { ...payload, expectedTotal: previous.expectedTotal };
        }
      } catch { /* Ignore an invalid stored attempt. */ }
      const requestSignature = JSON.stringify(payload);
      if (attempt.current?.signature !== requestSignature) attempt.current = { signature: requestSignature, id: crypto.randomUUID() };
      try { sessionStorage.setItem(storageKey, JSON.stringify(attempt.current)); } catch { /* Storage is optional. */ }
      const response = await authFetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, idempotencyKey: attempt.current.id }) }, ownerId);
      const result = await response.json();
      if (!response.ok) {
        if (useAuth.getState().user?.id !== ownerId || !mounted.current || currentCart.current !== signature) return;
        if (result.code === "PRICE_CHANGED") {
          try { sessionStorage.removeItem(storageKey); } catch { /* Storage is optional. */ }
          attempt.current = null;
          acceptPriceChange(result.quote);
          setPriceChange({ signature, before: payload.expectedTotal, after: result.quote.total });
          return;
        }
        // A definite stock/selection rejection invalidates the quote. Network
        // failures retain the same payload/key so a retry recovers an existing order.
        if (response.status === 409) retryQuote();
        throw new Error(result.error ?? "Захиалга үүсгэж чадсангүй.");
      }
      const order = result as OrderRecord;
      if (useAuth.getState().user?.id !== ownerId || !mounted.current) return;
      // Remove only quantities submitted by this checkout; preserve later additions.
      useCart.setState((state) => ({ items: state.items.map((item) => {
        const bought = selections.find((line) => line.productId === item.productId && line.color === item.color && line.material === item.material);
        return bought ? { ...item, qty: item.qty - bought.qty } : item;
      }).filter((item) => item.qty > 0) }));
      try { sessionStorage.removeItem(storageKey); } catch { /* Storage is optional. */ }
      attempt.current = null;
      void useCatalogStore.getState().refresh(true);
      if (mounted.current) {
        setCreated(order.id);
        router.push(`/orders/${order.id}`);
      }
    } catch (err) {
      if (mounted.current && useAuth.getState().user?.id === ownerId && currentCart.current === signature) setError(err instanceof Error ? err.message : "Сүлжээний алдаа гарлаа. Дахин оролдоно уу.");
    } finally { submitting.current = false; if (mounted.current) setBusy(false); }
  }

  if (created) return <div className="ui-empty"><h1>Захиалга бүртгэгдлээ</h1><Link className="btn-primary" href={`/orders/${created}`}>Төлбөрийн сонголт руу очих</Link></div>;
  if (!items.length) return <div className="ui-empty"><h1>Сагс хоосон байна</h1><p>Тавилгаа сонгоод захиалгаа үргэлжлүүлээрэй.</p><Link className="btn-primary" href="/catalog">Каталог үзэх</Link></div>;
  return <div className="shop-container checkout-shell py-8 sm:py-12">
    <nav aria-label="Захиалгын алхмууд" className="checkout-steps"><Link href="/cart">01 · Сагс</Link><ChevronRight size={13} /><span className="current" aria-current="step">02 · Хүргэлт</span><ChevronRight size={13} /><span>03 · Төлбөр</span></nav>
    <Link href="/cart" className="text-sm underline">Сагс руу буцах</Link>
    <h1 className="ui-title mt-4">Захиалга баталгаажуулах</h1>
    <form onSubmit={submit} className="mt-8 grid gap-8 md:grid-cols-2">
      <fieldset disabled={busy} className="ui-panel min-w-0 space-y-4 p-5 sm:p-7">
        <legend className="mb-4 text-xl">Хүргэлтийн мэдээлэл</legend>
        <label className="block text-sm">Хүлээн авагчийн нэр<input className="input mt-2" autoComplete="name" required minLength={2} maxLength={100} value={delivery.name} onChange={(e) => setDelivery({ ...delivery, name: e.target.value })} /></label>
        <label className="block text-sm">Утас<input className="input mt-2" type="tel" autoComplete="tel" required minLength={8} maxLength={24} value={delivery.phone} onChange={(e) => setDelivery({ ...delivery, phone: e.target.value })} /></label>
        <label className="block text-sm">Хүргэлтийн хаяг<textarea className="input mt-2" autoComplete="street-address" rows={4} required minLength={10} maxLength={500} placeholder="Хот, дүүрэг, хороо, байр, тоот" value={delivery.address} onChange={(e) => setDelivery({ ...delivery, address: e.target.value })} /></label>
      </fieldset>
      <section className="ui-panel p-5 sm:p-7" aria-busy={quoteLoading}>
        <h2 className="text-xl">Захиалгын дүн</h2>
        {currentQuote ? <>
          <ul className="my-4 space-y-3">{currentQuote.items.map((item) => <li key={JSON.stringify([item.productId, item.color, item.material])} className="text-sm"><p>{item.name} × {item.qty}</p>{item.stockQuantity != null && <p className="text-xs text-ui-accent">Шалгах үеийн үлдэгдэл: {item.stockQuantity} ширхэг</p>}<p className="text-ui-muted">{item.colorName} · {item.materialName}</p><p>{formatPrice(item.lineTotal)}</p></li>)}</ul>
          <p className="flex justify-between text-sm"><span>Хүргэлт</span><span>{currentQuote.shipping === 0 ? "Үнэгүй" : formatPrice(currentQuote.shipping)}</span></p>
          <p className="mt-4 flex justify-between font-semibold"><span>Нийт</span><span>{formatPrice(currentQuote.total)}</span></p>
        </> : quoteLoading ? <p role="status" className="my-4 text-sm text-ui-muted">Одоогийн үнэ, үлдэгдлийг шалгаж байна…</p> : null}
        {quoteError && <div className="my-4"><p role="alert" className="text-sm text-red-700">{quoteError}</p><button type="button" className="btn-ghost mt-2" onClick={retryQuote}>Дахин шалгах</button></div>}
        {changedPrice && <p role="alert" className="my-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Нийт дүн {formatPrice(changedPrice.before)}-өөс {formatPrice(changedPrice.after)} болж өөрчлөгдлөө. Захиалга хараахан үүсээгүй. Шинэ дүнг шалгаад дахин баталгаажуулна уу.</p>}
        {error && <p role="alert" className="my-4 text-sm text-red-700">{error}</p>}
        <button disabled={busy || !currentQuote || quoteLoading} className="btn-primary mt-6 w-full disabled:opacity-50">{busy ? "Захиалга үүсгэж байна…" : changedPrice ? "Шинэ дүнгээр баталгаажуулах" : "Захиалга баталгаажуулах"}</button>
        <p className="mt-3 text-xs text-ui-muted">Дараагийн алхамд боломжтой төлбөрийн аргыг сонгоно.</p>
      </section>
    </form>
  </div>;
}
