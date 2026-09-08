"use client";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/store/auth";
import { authFetch } from "@/lib/authFetch";
import { ORDER_STATUS_LABEL, type OrderRecord } from "@/lib/orders";
import { PAYMENT_METHOD_LABEL, type PaymentMethod, type PaymentView } from "@/lib/payments";
import { formatPrice } from "@/lib/format";

export default function OrderPage({ params }: { params: { id: string } }) {
  const userId = useAuth((state) => state.user?.id);
  const initialized = useAuth((state) => state.initialized);
  const [result, setResult] = useState<{ owner: string; order: OrderRecord; payment: PaymentView | null } | null>(null);
  const [methods, setMethods] = useState<{ id: PaymentMethod; name: string; available: boolean }[]>([]);
  const [method, setMethod] = useState<PaymentMethod>("qpay");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const response = await authFetch(`/api/orders/${params.id}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Захиалга олдсонгүй.");
      if (useAuth.getState().user?.id !== userId) return;
      setResult({ owner: userId, ...data });
      if (data.payment) setMethod(data.payment.method);
    } catch (err) { setError(err instanceof Error ? err.message : "Алдаа гарлаа."); }
  }, [params.id, userId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    fetch("/api/payments/methods").then((response) => response.json()).then((data) => { if (Array.isArray(data)) setMethods(data); }).catch(() => setError("Төлбөрийн сонголтууд ачаалсангүй. Хуудсаа шинэчилнэ үү."));
  }, []);
  const current = result && result.owner === userId && result.order.id === params.id ? result : null;
  async function startPayment() {
    if (busy || !current) return;
    setBusy(true); setError(null);
    try {
      const response = await authFetch(`/api/orders/${params.id}/payment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Төлбөрийн мэдээлэл ачаалсангүй.");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Алдаа гарлаа."); }
    finally { setBusy(false); }
  }
  if (!initialized) return <p className="p-12 text-center">Ачаалж байна…</p>;
  if (!userId) return <div className="p-12 text-center"><p>Захиалгаа үзэхийн тулд нэвтэрнэ үү.</p><Link href="/login" className="underline">Нэвтрэх</Link></div>;
  return <div className="mx-auto max-w-3xl px-6 py-12">
    <Link href="/account#orders" className="text-sm underline">Миний захиалгууд</Link>
    <h1 className="mt-4 text-3xl">Захиалгын дэлгэрэнгүй</h1>
    {error && <p role="alert" className="my-4 text-red-700">{error}</p>}
    {!current ? <button className="btn-ghost mt-6" onClick={load}>Дахин ачаалах</button> : <>
      <p className="mt-2 break-all font-mono text-xs">{current.order.id}</p>
      <p className="mt-3 font-medium text-[#42634F]">{ORDER_STATUS_LABEL[current.order.status]}</p>
      <ul className="my-6 divide-y">{current.order.items.map((item) => <li className="py-3 text-sm" key={JSON.stringify([item.productId, item.color, item.material])}><p>{item.name} × {item.qty}</p><p className="text-[#6C726B]">{item.colorName} · {item.materialName}</p><p>{formatPrice(item.lineTotal)}</p></li>)}</ul>
      <p>Хүргэлт: {formatPrice(current.order.shipping)}</p><p className="mt-2 text-xl font-semibold">Нийт: {formatPrice(current.order.total)}</p>
      <p className="mt-4 text-sm">{current.order.delivery.name} · {current.order.delivery.phone}<br />{current.order.delivery.address}</p>
      {current.order.status === "pending_payment" && <section className="mt-8 rounded-lg border border-[#293C32]/15 p-6">
        <h2 className="text-xl">Төлбөрийн арга</h2>
        {!current.payment && <fieldset className="my-4 space-y-3" disabled={busy}>{methods.map((option) => <label key={option.id} className="flex gap-3 text-sm"><input type="radio" name="paymentMethod" value={option.id} checked={method === option.id} disabled={!option.available} onChange={() => setMethod(option.id)} />{option.name}{!option.available && <span className="text-[#6C726B]">Түр боломжгүй</span>}</label>)}</fieldset>}
        {current.payment && <p className="my-3">{PAYMENT_METHOD_LABEL[current.payment.method]}</p>}
        {!current.payment?.instructions && <button className="btn-primary mt-3 disabled:opacity-50" disabled={busy || (!current.payment && !methods.find((option) => option.id === method)?.available)} onClick={startPayment}>{busy ? "Нэхэмжлэх бэлдэж байна…" : "Төлбөрийн мэдээлэл авах"}</button>}
        {current.payment?.instructions?.qrImage && <Image unoptimized src={current.payment.instructions.qrImage} width={256} height={256} alt="Төлбөр төлөх QPay QR код" className="mx-auto my-6" />}
        {current.payment?.instructions?.url && <a className="btn-primary mt-4" href={current.payment.instructions.url} rel="noopener noreferrer" target="_blank">{PAYMENT_METHOD_LABEL[current.payment.method]} нээх</a>}
        {current.payment?.instructions?.bank && <div className="my-4 space-y-2 text-sm"><p>Банк: {current.payment.instructions.bank.name}</p><p>Данс / IBAN: <strong>{current.payment.instructions.bank.account}</strong></p><p>Хүлээн авагч: {current.payment.instructions.bank.holder}</p><p className="break-all">Гүйлгээний утга: <strong>{current.payment.instructions.bank.reference}</strong></p><p>Шилжүүлэх дүн: {formatPrice(current.order.total)}</p><p className="text-[#6C726B]">Шилжүүлэг дансанд орсныг дэлгүүр шалгасны дараа төлөв шинэчлэгдэнэ.</p></div>}
        <button className="btn-ghost mt-4" disabled={busy} onClick={load}>Захиалгын төлөв шинэчлэх</button>
        <p className="mt-3 text-xs text-[#6C726B]">Төлбөр баталгаажих хүртэл захиалга “Төлбөр хүлээж буй” төлөвтэй байна.</p>
      </section>}
    </>}
  </div>;
}

