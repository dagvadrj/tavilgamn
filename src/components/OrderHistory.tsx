"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Search, RefreshCw, Package, ChevronLeft, ChevronRight, MapPin, CreditCard } from "lucide-react";
import { useAuth } from "@/store/auth";
import { authFetch } from "@/lib/authFetch";
import { formatPrice } from "@/lib/format";
import { ORDER_STATUS_LABEL, type OrderRecord } from "@/lib/orders";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/lib/payments";

type HistoryOrder = OrderRecord & { order_payments?: { method: PaymentMethod; state: string } | null };
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
    <button className="mb-4 text-sm underline disabled:opacity-50" disabled={loading} onClick={load}>Шинэчлэх</button>
    {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
    {loading ? <p className="text-sm">Захиалга ачаалж байна…</p> : !error && !current?.orders.length ? <p className="rounded-lg border border-dashed p-6 text-sm">Одоогоор захиалга алга.</p> : <div className="space-y-4">{current?.orders.map((order) => <article key={order.id} className="rounded-lg border border-[#293C32]/15 bg-[#FFFFFF] p-5">
      <p className="break-all font-mono text-xs">{order.id}</p>
      <div className="mt-3 flex flex-wrap justify-between gap-3"><p>{new Date(order.created_at).toLocaleDateString("mn-MN")} · {order.items.reduce((sum, item) => sum + item.qty, 0)} ширхэг</p><p className="font-semibold">{formatPrice(order.total)}</p></div>
      <p className="mt-2 text-sm text-[#42634F]">{ORDER_STATUS_LABEL[order.status]}</p>
      {admin ? <>
        <p className="mt-3 text-sm">{order.delivery.name} · {order.delivery.phone}<br />{order.delivery.address}</p>
        <ul className="mt-3 text-sm">{order.items.map((item) => <li key={JSON.stringify([item.productId, item.color, item.material])}>{item.name} · {item.colorName} · {item.materialName} × {item.qty}</li>)}</ul>
        {order.order_payments && <p className="mt-2 text-sm">{PAYMENT_METHOD_LABEL[order.order_payments.method]}{order.order_payments.state === "needs_review" ? " · Нэхэмжлэхийг шалгах шаардлагатай" : ""}</p>}
        {order.status === "pending_payment" && order.order_payments?.method === "bank_transfer" && <TransferConfirmation order={order} onConfirmed={load} />}
      </> : <Link className="mt-3 inline-block text-sm underline" href={`/orders/${order.id}`}>Дэлгэрэнгүй / төлбөр</Link>}
    </article>)}</div>}
    <div className="mt-4 flex gap-4"><button disabled={page === 0 || loading} className="text-sm underline disabled:opacity-40" onClick={() => setPage(page - 1)}>Өмнөх</button><span className="text-sm">{page + 1}</span><button disabled={!current?.hasMore || loading} className="text-sm underline disabled:opacity-40" onClick={() => setPage(page + 1)}>Дараах</button></div>
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

