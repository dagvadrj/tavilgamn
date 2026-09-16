"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Package, RefreshCw, Truck } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@/store/auth";
import { formatPrice } from "@/lib/format";
import type { DeliveryAddress, OrderLine } from "@/lib/orders";

type FulfillmentStatus = "pending" | "processing" | "shipped" | "delivered";
type MerchantOrder = {
  id: string; items: OrderLine[]; subtotal: number; currency: "MNT";
  delivery: DeliveryAddress; created_at: string; status: FulfillmentStatus;
  paymentStatus: "pending_payment" | "paid" | "cancelled";
};
const STATUS_LABEL: Record<FulfillmentStatus, string> = { pending: "Шинэ захиалга", processing: "Бэлтгэж буй", shipped: "Хүргэлтэд гарсан", delivered: "Хүргэгдсэн" };
const NEXT_STATUS: Partial<Record<FulfillmentStatus, FulfillmentStatus>> = { pending: "processing", processing: "shipped", shipped: "delivered" };
const ACTION_LABEL: Partial<Record<FulfillmentStatus, string>> = { pending: "Бэлтгэж эхлэх", processing: "Хүргэлтэд гаргах", shipped: "Хүргэснээр тэмдэглэх" };
const isOwner = (owner: string) => useAuth.getState().user?.id === owner && useAuth.getState().role === "merchant";

export function MerchantOrders({ owner }: { owner: string }) {
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{ orders: MerchantOrder[]; hasMore: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true); setError(null); setResult(null);
    void (async () => {
      try {
        const response = await authFetch(`/api/merchant/orders?page=${page}`, { signal: controller.signal }, owner);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Захиалгыг ачаалж чадсангүй.");
        if (active && isOwner(owner)) setResult(data);
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : "Захиалгыг ачаалж чадсангүй."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; controller.abort(); };
  }, [owner, page, refresh]);
  return <section>
    <div className="merchant-section-heading"><div><h2 className="text-2xl">Миний дэлгүүрийн захиалга</h2><p className="merchant-muted">Танай дэлгүүрээс захиалсан бараа болон хүргэлтийн мэдээлэл.</p></div><button className="btn-ghost" disabled={loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={16} />Шинэчлэх</button></div>
    {loading ? <div className="merchant-state" role="status">Захиалгыг ачаалж байна…</div> : error ? <p className="merchant-error" role="alert">{error}</p> : !result?.orders.length ? <div className="merchant-panel merchant-state"><Package size={32} /><h3>Одоогоор захиалга алга</h3><p>Таны барааг захиалахад мэдээлэл энд харагдана.</p></div> : <div className="merchant-orders">{result.orders.map(order => <MerchantOrderCard key={order.id} owner={owner} order={order} onUpdated={(status) => setResult(current => current && ({ ...current, orders: current.orders.map(item => item.id === order.id ? { ...item, status } : item) }))} />)}</div>}
    <nav className="merchant-actions" aria-label="Дэлгүүрийн захиалгын хуудаслалт"><span aria-live="polite" className="merchant-muted">Хуудас {page + 1}</span><button type="button" className="btn-ghost" disabled={page === 0 || loading} onClick={() => setPage(value => value - 1)}><ChevronLeft size={15} />Өмнөх</button><button type="button" className="btn-ghost" disabled={loading || !!error || !result?.hasMore} onClick={() => setPage(value => value + 1)}>Дараах<ChevronRight size={15} /></button></nav>
  </section>;
}

function MerchantOrderCard({ owner, order, onUpdated }: { owner: string; order: MerchantOrder; onUpdated: (status: FulfillmentStatus) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const next = NEXT_STATUS[order.status];
  return <article className="merchant-panel merchant-order">
    <header className="merchant-section-heading"><div><h3>Захиалга #{order.id.slice(0, 8).toUpperCase()}</h3><p>{new Date(order.created_at).toLocaleString("mn-MN", { timeZone: "Asia/Ulaanbaatar" })}</p></div><span className="merchant-order-status">{order.paymentStatus === "cancelled" ? "Цуцлагдсан" : STATUS_LABEL[order.status]}</span></header>
    <div className="merchant-order-details"><div><h4>Хүргэлтийн мэдээлэл</h4><p>{order.delivery.name}</p><p>{order.delivery.phone}</p><p>{order.delivery.address}</p></div><div><h4>Захиалсан бараа</h4><ul>{order.items.map(item => <li key={JSON.stringify([item.productId, item.color, item.material])}><strong>{item.name} × {item.qty}</strong><p>{item.colorName} · {item.materialName}</p><p>{formatPrice(item.lineTotal)}</p></li>)}</ul></div></div>
    <footer className="merchant-order-footer"><span>{order.paymentStatus === "paid" ? "Төлбөр төлөгдсөн" : order.paymentStatus === "cancelled" ? "Захиалга цуцлагдсан" : "Төлбөр хүлээж буй"}</span><span>Танай барааны дүн <strong>{formatPrice(order.subtotal)}</strong></span></footer>
    {next && order.paymentStatus === "paid" && <div className="merchant-actions"><button className="btn-primary" disabled={busy} onClick={async () => {
      if (busy) return;
      setBusy(true); setError(null); setMessage(null);
      try {
        const response = await authFetch("/api/merchant/orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: order.id, status: next, expectedStatus: order.status }) }, owner);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Захиалгын төлөвийг шинэчилж чадсангүй.");
        if (isOwner(owner)) { onUpdated(next); setMessage("Захиалгын төлөв шинэчлэгдлээ."); }
      } catch (reason) { setError(reason instanceof Error ? reason.message : "Захиалгын төлөвийг шинэчилж чадсангүй."); }
      finally { setBusy(false); }
    }}><Truck size={16} />{busy ? "Шинэчилж байна…" : ACTION_LABEL[order.status]}</button></div>}
    {error && <p className="merchant-error" role="alert">{error}</p>}{message && <p className="merchant-success" role="status">{message}</p>}
  </article>;
}
