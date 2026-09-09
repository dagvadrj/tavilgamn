"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  ExternalLink,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Truck,
  UserRound,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/store/auth";
import { authFetch } from "@/lib/authFetch";
import {
  ORDER_STATUS_LABEL,
  type OrderRecord,
  type OrderStatus,
} from "@/lib/orders";
import {
  PAYMENT_METHOD_LABEL,
  type PaymentMethod,
  type PaymentView,
} from "@/lib/payments";
import { formatDateTime, formatPrice, cn } from "@/lib/format";

const ORDER_FLOW: { status: OrderStatus; label: string }[] = [
  { status: "pending_payment", label: "Захиалга үүссэн" },
  { status: "paid", label: "Төлбөр баталгаажсан" },
  { status: "processing", label: "Бэлтгэж буй" },
  { status: "shipped", label: "Хүргэлтэд гарсан" },
  { status: "delivered", label: "Хүргэгдсэн" },
];

const STATUS_TONE: Record<OrderStatus, string> = {
  pending_payment: "bg-[#FFF4E5] text-[#9A5B20]",
  paid: "bg-[#EAF3EC] text-[#42634F]",
  processing: "bg-[#EDF1F7] text-[#48617B]",
  shipped: "bg-[#E8F2F4] text-[#356773]",
  delivered: "bg-[#E8F4E9] text-[#35623C]",
  cancelled: "bg-[#F8EAEA] text-[#9A4D4D]",
};

const PAYMENT_STATE_LABEL: Record<PaymentView["state"], string> = {
  creating: "Нэхэмжлэх үүсгэж байна",
  ready: "Төлбөр хүлээж байна",
  needs_review: "Дэлгүүрээр шалгуулах шаардлагатай",
  paid: "Төлбөр баталгаажсан",
};

export default function OrderPage({ params }: { params: { id: string } }) {
  const userId = useAuth((state) => state.user?.id);
  const initialized = useAuth((state) => state.initialized);
  const [result, setResult] = useState<{
    owner: string;
    order: OrderRecord;
    payment: PaymentView | null;
  } | null>(null);
  const [methods, setMethods] = useState<
    { id: PaymentMethod; name: string; available: boolean }[]
  >([]);
  const [method, setMethod] = useState<PaymentMethod>("qpay");
  const [loading, setLoading] = useState(true);
  const [methodsLoading, setMethodsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [methodsError, setMethodsError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`/api/orders/${params.id}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Захиалга олдсонгүй.");
      if (useAuth.getState().user?.id !== userId) return;
      setResult({ owner: userId, ...data });
      if (data.payment) setMethod(data.payment.method);
    } catch (loadError) {
      if (useAuth.getState().user?.id === userId) {
        setError(loadError instanceof Error ? loadError.message : "Алдаа гарлаа.");
      }
    } finally {
      if (useAuth.getState().user?.id === userId) setLoading(false);
    }
  }, [params.id, userId]);

  useEffect(() => {
    setResult(null);
    void load();
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setMethodsLoading(true);
    setMethodsError(null);
    fetch("/api/payments/methods", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !Array.isArray(data)) {
          throw new Error("Төлбөрийн сонголтууд ачаалсангүй.");
        }
        if (active) setMethods(data);
      })
      .catch((methodError) => {
        if (active) {
          setMethodsError(
            methodError instanceof Error
              ? methodError.message
              : "Төлбөрийн сонголтууд ачаалсангүй.",
          );
        }
      })
      .finally(() => {
        if (active) setMethodsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const current =
    result && result.owner === userId && result.order.id === params.id
      ? result
      : null;

  async function startPayment() {
    if (busy || !current) return;
    setBusy(true);
    setError(null);
    try {
      const response = await authFetch(`/api/orders/${params.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Төлбөрийн мэдээлэл ачаалсангүй.");
      }
      await load();
    } catch (paymentError) {
      setError(
        paymentError instanceof Error ? paymentError.message : "Алдаа гарлаа.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyValue(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setError("Хуулах боломжгүй байна. Утгыг сонгож гараар хуулна уу.");
    }
  }

  if (!initialized) {
    return <div className="grid min-h-[50vh] place-items-center text-sm text-[#6C726B]"><span className="flex items-center gap-2"><RefreshCw className="animate-spin" size={16} />Ачаалж байна…</span></div>;
  }

  if (!userId) {
    return <div className="shop-container py-12"><div className="shop-empty"><Package size={42} /><h1>Захиалгаа үзэхийн тулд нэвтэрнэ үү</h1><p>Нэвтэрсний дараа энэ захиалгын мэдээлэл рүү буцаж орно.</p><Link href={`/login?next=${encodeURIComponent(`/orders/${params.id}`)}`} className="btn-primary">Нэвтрэх</Link></div></div>;
  }

  if (loading && !current) {
    return <div className="shop-container py-12"><div className="grid min-h-64 place-items-center rounded-2xl border border-[#293C32]/10 bg-white text-sm text-[#6C726B]" role="status"><span className="flex items-center gap-2"><RefreshCw className="animate-spin" size={16} />Захиалгын мэдээлэл ачаалж байна…</span></div></div>;
  }

  if (!current) {
    return <div className="shop-container py-12"><Link href="/account#orders" className="inline-flex min-h-11 items-center gap-2 text-sm text-[#6C726B]"><ArrowLeft size={16} />Миний захиалгууд</Link><div className="shop-empty mt-5"><XCircle size={42} /><h1>Захиалгыг харуулж чадсангүй</h1><p>{error ?? "Захиалга олдсонгүй."}</p><button className="btn-primary" onClick={load}>Дахин ачаалах</button></div></div>;
  }

  const { order, payment } = current;
  const quantity = order.items.reduce((sum, item) => sum + item.qty, 0);
  const activeStep = ORDER_FLOW.findIndex((step) => step.status === order.status);
  const selectedMethodAvailable = methods.some(
    (option) => option.id === method && option.available,
  );

  return <main className="shop-container max-w-[1180px] py-7 sm:py-10">
    <Link href="/account#orders" className="inline-flex min-h-11 items-center gap-2 text-sm text-[#6C726B] transition hover:text-[#293C32]"><ArrowLeft size={16} />Миний захиалгууд</Link>

    <section className="mt-3 overflow-hidden rounded-[22px] border border-[#293C32]/10 bg-white shadow-[0_18px_55px_rgba(41,60,50,.05)]">
      <div className="flex flex-wrap items-start justify-between gap-5 bg-[#F3F1EB] px-5 py-6 sm:px-7">
        <div>
          <p className="text-xs font-medium uppercase tracking-[.1em] text-[#737D6C]">Захиалгын дэлгэрэнгүй</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#293C32] sm:text-3xl">Захиалга #{order.id.slice(0, 8).toUpperCase()}</h1>
          <p className="mt-2 break-all font-mono text-[11px] text-[#6C726B]">{order.id}</p>
        </div>
        <div className="text-left sm:text-right">
          <span className={cn("inline-flex rounded-full px-3 py-1.5 text-xs font-medium", STATUS_TONE[order.status])}>{ORDER_STATUS_LABEL[order.status]}</span>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-[#6C726B] sm:justify-end"><Clock3 size={13} />{formatDateTime(order.created_at)}</p>
        </div>
      </div>

      {order.status === "cancelled" ? (
        <div className="flex gap-3 border-t border-[#293C32]/10 bg-[#FDF6F6] px-5 py-4 text-sm text-[#8A4B4B] sm:px-7"><XCircle className="mt-0.5 shrink-0" size={18} /><p>Энэ захиалга цуцлагдсан. Тусгаарласан барааны нөөцийг буцаасан.</p></div>
      ) : (
        <ol className="grid grid-cols-5 border-t border-[#293C32]/10 px-3 py-5 sm:px-7" aria-label="Захиалгын явц">
          {ORDER_FLOW.map((step, index) => {
            const complete = index <= activeStep;
            return <li key={step.status} className="relative flex min-w-0 flex-col items-center text-center">
              {index > 0 && <span className={cn("absolute right-1/2 top-3 h-0.5 w-full", index <= activeStep ? "bg-[#42634F]" : "bg-[#DDE1D8]")} />}
              <span className={cn("relative z-10 grid h-6 w-6 place-items-center rounded-full border-2 bg-white", complete ? "border-[#42634F] text-[#42634F]" : "border-[#C9CFC5] text-[#A0A79D]")}>{complete ? <Check size={13} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</span>
              <span className={cn("mt-2 max-w-24 text-[9px] leading-4 sm:text-[11px]", complete ? "font-medium text-[#293C32]" : "text-[#8A9188]")}>{step.label}</span>
            </li>;
          })}
        </ol>
      )}
    </section>

    {error && <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><span>{error}</span><button type="button" className="underline" onClick={() => setError(null)}>Хаах</button></div>}

    <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
      <section className="overflow-hidden rounded-2xl border border-[#293C32]/10 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-[#293C32]/10 px-5 py-4 sm:px-6"><h2 className="flex items-center gap-2 font-semibold"><Package size={18} className="text-[#AD6547]" />Захиалсан бараа</h2><span className="text-xs text-[#6C726B]">{quantity} ширхэг · {order.items.length} нэр төрөл</span></div>
        <ul className="divide-y divide-[#293C32]/10">
          {order.items.map((item) => <li key={JSON.stringify([item.productId, item.color, item.material])} className="flex gap-4 p-5 sm:p-6">
            <div className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#EFEDE6] text-[#73806F] sm:h-24 sm:w-24">
              {item.image ? <Image src={item.image} alt="" fill sizes="96px" className="object-cover" /> : <Package size={24} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-1"><h3 className="font-medium text-[#293C32]">{item.name}</h3><strong className="shrink-0 tabular-nums">{formatPrice(item.lineTotal)}</strong></div>
              <p className="mt-1 text-xs text-[#6C726B]">{item.colorName} · {item.materialName}</p>
              <p className="mt-3 text-sm text-[#6C726B]">{formatPrice(item.unitPrice)} × {item.qty} ширхэг</p>
            </div>
          </li>)}
        </ul>
        <dl className="space-y-3 border-t border-[#293C32]/10 bg-[#FAF9F6] px-5 py-5 text-sm sm:px-6">
          <div className="flex justify-between gap-4"><dt className="text-[#6C726B]">Барааны дүн</dt><dd className="tabular-nums">{formatPrice(order.subtotal)}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-[#6C726B]">Хүргэлт</dt><dd className="tabular-nums">{order.shipping === 0 ? "Үнэгүй" : formatPrice(order.shipping)}</dd></div>
          <div className="flex justify-between gap-4 border-t border-[#293C32]/10 pt-4 text-lg font-semibold"><dt>Нийт төлөх дүн</dt><dd className="tabular-nums text-[#AD6547]">{formatPrice(order.total)}</dd></div>
        </dl>
      </section>

      <div className="space-y-6">
        <section className="rounded-2xl border border-[#293C32]/10 bg-white p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-semibold"><MapPin size={18} className="text-[#AD6547]" />Хүргэлтийн мэдээлэл</h2>
          <dl className="mt-5 space-y-4 text-sm">
            <div className="flex gap-3"><UserRound size={16} className="mt-0.5 shrink-0 text-[#73806F]" /><div><dt className="text-xs text-[#6C726B]">Хүлээн авагч</dt><dd className="mt-1 font-medium">{order.delivery.name}</dd></div></div>
            <div className="flex gap-3"><Phone size={16} className="mt-0.5 shrink-0 text-[#73806F]" /><div><dt className="text-xs text-[#6C726B]">Утас</dt><dd className="mt-1 font-medium">{order.delivery.phone}</dd></div></div>
            <div className="flex gap-3"><Truck size={16} className="mt-0.5 shrink-0 text-[#73806F]" /><div><dt className="text-xs text-[#6C726B]">Хаяг</dt><dd className="mt-1 leading-6">{order.delivery.address}</dd></div></div>
          </dl>
        </section>

        <section className="rounded-2xl border border-[#293C32]/10 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><CreditCard size={18} className="text-[#AD6547]" />Төлбөр</h2>{payment && <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", payment.state === "paid" ? "bg-[#EAF3EC] text-[#42634F]" : payment.state === "needs_review" ? "bg-[#F8EAEA] text-[#9A4D4D]" : "bg-[#FFF4E5] text-[#9A5B20]")}>{PAYMENT_STATE_LABEL[payment.state]}</span>}</div>

          {order.status === "cancelled" ? (
            <div className="mt-5 flex gap-3 rounded-xl bg-[#FDF6F6] p-4 text-sm text-[#8A4B4B]"><XCircle className="shrink-0" size={19} /><div><p className="font-medium">Захиалга цуцлагдсан</p><p className="mt-1 text-xs">Энэ захиалгаар төлбөр хийх боломжгүй.</p></div></div>
          ) : order.status !== "pending_payment" ? (
            <div className="mt-5 flex gap-3 rounded-xl bg-[#EEF4ED] p-4 text-sm text-[#42634F]"><CheckCircle2 className="shrink-0" size={19} /><div><p className="font-medium">Төлбөр баталгаажсан</p><p className="mt-1 text-xs">{payment ? PAYMENT_METHOD_LABEL[payment.method] : "Захиалгын төлбөр"} · {formatPrice(order.total)}</p></div></div>
          ) : <>
            {!payment && <>
              <p className="mt-4 text-sm leading-6 text-[#6C726B]">Төлбөрийн аргаа сонгоод нэхэмжлэхээ авна уу.</p>
              {methodsLoading ? <p className="mt-4 flex items-center gap-2 text-sm text-[#6C726B]"><RefreshCw className="animate-spin" size={15} />Сонголтууд ачаалж байна…</p> : methodsError ? <p role="alert" className="mt-4 text-sm text-red-700">{methodsError} Хуудсаа шинэчилж дахин оролдоно уу.</p> : <fieldset className="mt-4 grid gap-2" disabled={busy}>{methods.map((option) => <label key={option.id} className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 text-sm", method === option.id ? "border-[#42634F] bg-[#42634F]/5" : "border-[#293C32]/15", !option.available && "cursor-not-allowed opacity-45")}><input type="radio" name="paymentMethod" value={option.id} checked={method === option.id} disabled={!option.available} onChange={() => setMethod(option.id)} className="accent-[#42634F]" /><span className="font-medium">{option.name}</span>{!option.available && <span className="ml-auto text-xs">Түр боломжгүй</span>}</label>)}</fieldset>}
              <button className="btn-primary mt-5 w-full disabled:opacity-50" disabled={busy || methodsLoading || !selectedMethodAvailable} onClick={startPayment}>{busy ? "Нэхэмжлэх бэлдэж байна…" : "Төлбөрийн мэдээлэл авах"}</button>
            </>}

            {payment && <p className="mt-4 text-sm"><span className="text-[#6C726B]">Сонгосон арга:</span> <strong>{PAYMENT_METHOD_LABEL[payment.method]}</strong></p>}
            {payment?.state === "creating" && <div className="mt-4 rounded-xl bg-[#FFF8EB] p-4 text-sm text-[#8A622D]">Нэхэмжлэх үүсэж байна. Түр хүлээгээд захиалгын төлөвийг шинэчилнэ үү.</div>}
            {payment?.state === "needs_review" && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><p className="font-medium">Давхар төлбөр бүү хийгээрэй.</p><p className="mt-1">Нэхэмжлэхийн хариуг дэлгүүрээр шалгуулах шаардлагатай.</p><Link href="/about#contact" className="mt-3 inline-block underline">Холбоо барих</Link></div>}
            {payment?.instructions?.qrImage && <div className="mt-5 text-center"><Image unoptimized src={payment.instructions.qrImage} width={240} height={240} alt="Төлбөр төлөх QPay QR код" className="mx-auto rounded-xl border border-[#293C32]/10 bg-white p-2" /><p className="mt-2 text-xs text-[#6C726B]">Банкны апп-аар QR кодыг уншуулна уу.</p></div>}
            {payment?.instructions?.url && <a className="btn-primary mt-5 w-full" href={payment.instructions.url} rel="noopener noreferrer" target="_blank">{PAYMENT_METHOD_LABEL[payment.method]} нээх<ExternalLink size={16} /></a>}
            {payment?.instructions?.bank && <div className="mt-5 space-y-3 rounded-xl bg-[#F8F7F3] p-4 text-sm">
              <div><p className="text-xs text-[#6C726B]">Банк</p><p className="mt-1 font-medium">{payment.instructions.bank.name}</p></div>
              <div><p className="text-xs text-[#6C726B]">Данс / IBAN</p><div className="mt-1 flex items-center justify-between gap-3"><strong className="break-all">{payment.instructions.bank.account}</strong><button type="button" aria-label="Дансны дугаар хуулах" onClick={() => copyValue("account", payment.instructions!.bank!.account)} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#293C32]/15">{copied === "account" ? <Check size={15} /> : <Copy size={15} />}</button></div></div>
              <div><p className="text-xs text-[#6C726B]">Хүлээн авагч</p><p className="mt-1 font-medium">{payment.instructions.bank.holder}</p></div>
              <div><p className="text-xs text-[#6C726B]">Гүйлгээний утга</p><div className="mt-1 flex items-center justify-between gap-3"><strong className="break-all text-[#AD6547]">{payment.instructions.bank.reference}</strong><button type="button" aria-label="Гүйлгээний утга хуулах" onClick={() => copyValue("reference", payment.instructions!.bank!.reference)} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#293C32]/15">{copied === "reference" ? <Check size={15} /> : <Copy size={15} />}</button></div></div>
              <div className="flex justify-between gap-4 border-t border-[#293C32]/10 pt-3"><span>Шилжүүлэх дүн</span><strong className="tabular-nums">{formatPrice(order.total)}</strong></div>
              <p className="text-xs leading-5 text-[#6C726B]">Шилжүүлэг дансанд орсныг дэлгүүр шалгасны дараа төлөв шинэчлэгдэнэ.</p>
            </div>}
            {payment && <button className="btn-ghost mt-5 w-full" disabled={loading || busy} onClick={load}><RefreshCw className={loading ? "animate-spin" : ""} size={15} />Захиалгын төлөв шинэчлэх</button>}
          </>}
        </section>
      </div>
    </div>
  </main>;
}
