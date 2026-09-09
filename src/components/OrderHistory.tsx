"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Search, RefreshCw, Package, ChevronLeft, ChevronRight, MapPin, CreditCard, CalendarDays, ArrowUpRight } from "lucide-react";
import { useAuth } from "@/store/auth";
import { authFetch } from "@/lib/authFetch";
import { formatDateTime, formatPrice } from "@/lib/format";
import { ORDER_STATUS_LABEL, type OrderRecord, type OrderStatus } from "@/lib/orders";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/lib/payments";

type HistoryOrder = OrderRecord & { order_payments?: { method: PaymentMethod; state: string } | null };

const userStatusTone: Record<OrderStatus, string> = {
  pending_payment: "bg-[#FFF4E5] text-[#9A5B20]",
  paid: "bg-[#EAF3EC] text-[#42634F]",
  processing: "bg-[#EDF1F7] text-[#48617B]",
  shipped: "bg-[#E8F2F4] text-[#356773]",
  delivered: "bg-[#E8F4E9] text-[#35623C]",
  cancelled: "bg-[#F8EAEA] text-[#9A4D4D]",
};

const shortOrderId = (id: string) => id.slice(0, 8).toUpperCase();
export function OrderHistory({ admin = false }: { admin?: boolean }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const userId = useAuth((state) => state.user?.id);
  const [result, setResult] = useState<{ owner: string; orders: HistoryOrder[]; hasMore: boolean } | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true); setError(null);
    try {
      const response = await authFetch(`${admin ? "/api/admin/orders" : "/api/orders"}?page=${page}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Захиалга ачаалсангүй.");
      if (useAuth.getState().user?.id === userId) setResult({ owner: userId, ...data });
    } catch (err) { setError(err instanceof Error ? err.message : "Алдаа гарлаа."); }
    finally { setLoading(false); }
  }, [admin, page, userId]);
  useEffect(() => { setPage(0); setResult(null); }, [userId]);
  useEffect(() => { void load(); }, [load]);
  const current = result?.owner === userId ? result : null;
  const visible = current?.orders.filter(order => (!status || order.status === status) && `${order.id} ${order.delivery.name} ${order.delivery.phone}`.toLowerCase().includes(query.trim().toLowerCase())) ?? [];
  if (admin) return <div>
    <div className="admin-toolbar"><label className="admin-search"><Search size={18} /><input aria-label="Энэ хуудсанд захиалга хайх" placeholder="Энэ хуудсанд нэр, утас, дугаараар хайх…" value={query} onChange={e=>setQuery(e.target.value)} /></label><select className="input" aria-label="Энэ хуудсан дахь захиалгын төлөв" value={status} onChange={e=>setStatus(e.target.value)}><option value="">Бүх төлөв</option>{Object.entries(ORDER_STATUS_LABEL).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button type="button" className="btn-ghost" disabled={loading} onClick={load}><RefreshCw size={15} />Шинэчлэх</button></div>
    {error && <p role="alert" className="admin-error">{error}</p>}
    {loading ? <div className="admin-loading" role="status"><Package size={25} />Захиалгуудыг ачаалж байна…</div> : !error && <>
      <p className="admin-result-count">{visible.length} захиалга · Энэ хуудсанд</p>
      {!visible.length ? <div className="admin-empty"><Package size={32} /><strong>{query || status ? "Тохирох захиалга олдсонгүй" : "Одоогоор захиалга алга"}</strong><p>Хайх үг, төлөв эсвэл хуудсаа өөрчилж үзээрэй.</p></div> : <div className="admin-orders-grid">{visible.map(order=><article key={order.id} className="admin-order">
        <header className="admin-order-header"><div><p className="admin-order-id">Захиалга #{order.id}</p><h3>{new Date(order.created_at).toLocaleDateString("mn-MN", {timeZone:"Asia/Ulaanbaatar"})} · {order.items.reduce((sum,item)=>sum+item.qty,0)} ширхэг</h3></div><span className={"admin-status " + (order.status === "pending_payment" ? "pending" : order.status === "cancelled" ? "cancelled" : "")}>{ORDER_STATUS_LABEL[order.status]}</span></header>
        <div className="admin-order-body"><div className="admin-order-details"><div><h4 className="flex items-center gap-2"><MapPin size={13} />ХҮРГЭЛТИЙН МЭДЭЭЛЭЛ</h4><p className="font-medium">{order.delivery.name}</p><p>{order.delivery.phone}</p><p className="text-[#829072]">{order.delivery.address}</p></div><div><h4>ЗАХИАЛСАН БАРАА</h4><ul>{order.items.map(item=><li key={JSON.stringify([item.productId,item.color,item.material])}><p className="font-medium">{item.name} × {item.qty}</p><p className="text-xs text-[#8a967c]">{item.colorName} · {item.materialName}</p></li>)}</ul></div></div>
        <div className="admin-order-footer"><span className="flex items-center gap-2"><CreditCard size={15} />{order.order_payments ? PAYMENT_METHOD_LABEL[order.order_payments.method] : "Төлбөрийн арга сонгоогүй"}</span><span>Нийт дүн <strong className="ml-3">{formatPrice(order.total)}</strong></span></div>
        {order.order_payments?.state === "needs_review" && <p className="admin-error">Нэхэмжлэхийг шалгах шаардлагатай.</p>}
        {order.status === "pending_payment" && order.order_payments?.method === "bank_transfer" && <details className="admin-transfer"><summary>Банкны шилжүүлэг шалгах, баталгаажуулах</summary><TransferConfirmation order={order} onConfirmed={load} /></details>}
        </div>
      </article>)}</div>}
    </>}
    <nav className="admin-pagination" aria-label="Захиалгын хуудаслалт"><span aria-live="polite">Хуудас {page + 1}</span><button type="button" disabled={page===0 || loading} onClick={()=>{setPage(page-1);setQuery("");setStatus("");}}><ChevronLeft size={14} />Өмнөх</button><button type="button" disabled={!current?.hasMore || loading || !!error} onClick={()=>{setPage(page+1);setQuery("");setStatus("");}}>Дараах<ChevronRight size={14} /></button></nav>
  </div>;
  return <div className="mt-6">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <select
        className="min-h-11 rounded-xl border border-[#293C32]/15 bg-white px-3 text-sm"
        aria-label="Захиалгын төлөвөөр шүүх"
        value={status}
        onChange={(event) => setStatus(event.target.value)}
      >
        <option value="">Бүх төлөв</option>
        {Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <button className="btn-ghost !min-h-11 !px-4" disabled={loading} onClick={load}>
        <RefreshCw className={loading ? "animate-spin" : ""} size={15} />
        Шинэчлэх
      </button>
    </div>
    {error && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><span>{error}</span><button className="underline" onClick={load}>Дахин оролдох</button></div>}
    {loading ? (
      <div className="grid min-h-36 place-items-center rounded-2xl border border-[#293C32]/10 bg-white text-sm text-[#6C726B]" role="status"><span className="flex items-center gap-2"><RefreshCw className="animate-spin" size={16} />Захиалгуудыг ачаалж байна…</span></div>
    ) : !error && !visible.length ? (
      <div className="shop-empty !py-12"><Package size={36} /><h3>{status ? "Энэ төлөвтэй захиалга алга" : "Одоогоор захиалга алга"}</h3><p>Сонгосон тавилгаа захиалсны дараа мэдээлэл энд харагдана.</p><Link href="/catalog" className="btn-primary">Тавилга үзэх</Link></div>
    ) : (
      <div className="space-y-4">
        {visible.map((order) => {
          const quantity = order.items.reduce((sum, item) => sum + item.qty, 0);
          return <article key={order.id} className="overflow-hidden rounded-2xl border border-[#293C32]/10 bg-white shadow-[0_10px_35px_rgba(41,60,50,.04)]">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#293C32]/10 bg-[#F8F7F3] px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-[#293C32]" title={order.id}>Захиалга #{shortOrderId(order.id)}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-[#6C726B]"><CalendarDays size={13} />{formatDateTime(order.created_at)}</p>
              </div>
              <span className={`rounded-full px-3 py-1.5 text-xs font-medium ${userStatusTone[order.status]}`}>{ORDER_STATUS_LABEL[order.status]}</span>
            </header>
            <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[.08em] text-[#737D6C]">{quantity} ширхэг · {order.items.length} нэр төрөл</p>
                <ul className="mt-3 space-y-2">
                  {order.items.slice(0, 3).map((item) => <li key={JSON.stringify([item.productId, item.color, item.material])} className="flex justify-between gap-4 text-sm"><span className="min-w-0 truncate">{item.name} × {item.qty}</span><span className="shrink-0 tabular-nums text-[#6C726B]">{formatPrice(item.lineTotal)}</span></li>)}
                </ul>
                {order.items.length > 3 && <p className="mt-2 text-xs text-[#6C726B]">+{order.items.length - 3} нэр төрөл</p>}
                <p className="mt-4 flex items-center gap-2 text-xs text-[#6C726B]"><CreditCard size={14} />{order.order_payments ? PAYMENT_METHOD_LABEL[order.order_payments.method] : order.status === "pending_payment" ? "Төлбөрийн арга сонгоогүй" : "Төлбөрийн мэдээлэл бүртгэгдээгүй"}</p>
              </div>
              <div className="sm:text-right">
                <p className="text-xs text-[#6C726B]">Нийт дүн</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-[#AD6547]">{formatPrice(order.total)}</p>
                <Link className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#293C32]/15 px-4 text-sm font-medium transition hover:bg-[#293C32] hover:text-white" href={`/orders/${order.id}`}>Дэлгэрэнгүй {order.status === "pending_payment" ? "ба төлбөр" : "үзэх"}<ArrowUpRight size={15} /></Link>
              </div>
            </div>
          </article>;
        })}
      </div>
    )}
    <nav className="mt-5 flex items-center justify-center gap-3" aria-label="Захиалгын хуудаслалт">
      <button disabled={page === 0 || loading} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-[#293C32]/15 px-3 text-sm disabled:opacity-40" onClick={() => setPage(page - 1)}><ChevronLeft size={15} />Өмнөх</button>
      <span className="min-w-20 text-center text-sm text-[#6C726B]" aria-live="polite">Хуудас {page + 1}</span>
      <button disabled={!current?.hasMore || loading} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-[#293C32]/15 px-3 text-sm disabled:opacity-40" onClick={() => setPage(page + 1)}>Дараах<ChevronRight size={15} /></button>
    </nav>
  </div>;
}

function TransferConfirmation({ order, onConfirmed }: { order: OrderRecord; onConfirmed: () => Promise<void> }) {
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return <form className="mt-4 space-y-3 border-t pt-4" onSubmit={async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const response = await authFetch(`/api/admin/orders/${order.id}/confirm-transfer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference, amount: Number(amount) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Баталгаажуулж чадсангүй.");
      await onConfirmed();
    } catch (err) { setError(err instanceof Error ? err.message : "Алдаа гарлаа."); }
    finally { setBusy(false); }
  }}>
    <p className="text-sm">Дансны хуулгаас хүлээн авсан дүн, гүйлгээний дугаарыг тулгаж оруулна уу.</p>
    <label className="block text-sm">Банкны гүйлгээний дугаар<input className="input mt-1" required minLength={3} maxLength={100} value={reference} onChange={(e) => setReference(e.target.value)} /></label>
    <label className="block text-sm">Хүлээн авсан дүн (₮)<input className="input mt-1" required type="number" min="0" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
    <label className="flex gap-2 text-sm"><input type="checkbox" required />Дансанд орсныг хуулгатай тулгаж шалгасан</label>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <button disabled={busy} className="btn-primary disabled:opacity-50">{busy ? "Баталгаажуулж байна…" : "Шилжүүлэг хүлээн авсныг баталгаажуулах"}</button>
  </form>;
}

