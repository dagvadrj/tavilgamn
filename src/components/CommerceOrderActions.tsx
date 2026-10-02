"use client";

import { useRef, useState } from "react";
import { ClipboardList, RefreshCw, Truck } from "lucide-react";
import type { OrderRecord } from "@/lib/orders";
import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@/store/auth";
import { formatDateTime, formatPrice } from "@/lib/format";
import { CANCELLATION_LABEL, FULFILLMENT_LABEL, canRequestCancellation, type CommerceOrderDetails, type OrderCancellation } from "@/lib/commerceOperations";

type CommerceOrder = OrderRecord & CommerceOrderDetails;

export function CancellationSummary({ cancellation, paid }: { cancellation: OrderCancellation; paid: boolean }) {
  return <div className="rounded-xl border border-[#293C32]/15 bg-[#F8F7F3] p-4 text-sm">
    <p className="font-semibold">{CANCELLATION_LABEL[cancellation.status]}</p>
    <p className="mt-1 text-xs text-[#6C726B]">{formatDateTime(cancellation.requested_at)}</p>
    <p className="mt-3 whitespace-pre-wrap break-words">{cancellation.reason}</p>
    {cancellation.review_note && <p className="mt-3 whitespace-pre-wrap break-words text-[#6C726B]">Шийдвэр: {cancellation.review_note}</p>}
    {cancellation.status === "requested" && <p className="mt-3 text-xs text-[#6C726B]">Шалгалт дуусах хүртэл дахин төлбөр бүү хийгээрэй.</p>}
    {cancellation.status === "approved" && paid && <p className="mt-3 text-xs text-[#9A5B20]">Цуцлалт нь мөнгө буцсан гэсэн үг биш. Бодит шилжүүлэг шалгагдаж, бүртгэгдэх хүртэл буцаалт хүлээгдэнэ.</p>}
    {cancellation.status === "refunded" && <p className="mt-3 break-words text-xs text-[#42634F]">Бүртгэлтэй буцаалтын дугаар: {cancellation.refund_reference}{cancellation.refunded_at && ` · ${formatDateTime(cancellation.refunded_at)}`}</p>}
  </div>;
}

export function CustomerOrderActions({ order, paid, onUpdated }: { order: CommerceOrder; paid: boolean; onUpdated: () => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const owner = useAuth(state => state.user?.id);
  if (order.order_cancellations) return <CancellationSummary cancellation={order.order_cancellations} paid={paid} />;
  if (!canRequestCancellation(order)) return null;
  return <details className="rounded-xl border border-[#293C32]/15 bg-white p-4 text-sm">
    <summary className="cursor-pointer font-medium">Захиалга цуцлах хүсэлт</summary>
    <form className="mt-4 space-y-3" onSubmit={async event => {
      event.preventDefault();
      if (pending.current || !owner) return;
      pending.current = true; setBusy(true); setError(null);
      try {
        const response = await authFetch(`/api/orders/${order.id}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) }, owner);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Хүсэлт илгээгдсэнгүй.");
        if (useAuth.getState().user?.id === owner) await onUpdated();
      } catch (issue) {
        if (useAuth.getState().user?.id === owner) setError(issue instanceof Error ? issue.message : "Хүсэлт илгээгдсэнгүй.");
      } finally { pending.current = false; setBusy(false); }
    }}>
      <p className="text-xs leading-relaxed text-[#6C726B]">Төлбөрийн нэхэмжлэх үүссэн эсвэл төлбөр төлсөн бол админ шалгаж шийдвэрлэнэ. Хүргэлтэд гарсан захиалгыг эндээс цуцлахгүй.</p>
      <label className="block">Шалтгаан<textarea className="input mt-1 min-h-24" required minLength={5} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} /></label>
      <label className="flex items-start gap-2 text-xs"><input required type="checkbox" className="mt-0.5" />Хүсэлт илгээх нь шууд мөнгө буцаахгүйг ойлгосон.</label>
      {error && <p className="text-red-700" role="alert">{error}</p>}
      <button className="btn-ghost" disabled={busy}>{busy ? "Илгээж байна…" : "Цуцлах хүсэлт илгээх"}</button>
    </form>
  </details>;
}

export function OrderFulfillmentSummary({ order, admin = false }: { order: CommerceOrder; admin?: boolean }) {
  const fulfillments = order.merchant_order_fulfillments ?? [];
  if (!fulfillments.length && !order.platform_fulfillment_status) return null;
  return <section className="rounded-xl border border-[#293C32]/15 bg-white p-4 text-sm">
    <h3 className="flex items-center gap-2 font-semibold"><Truck size={16} />Дэлгүүр тус бүрийн хүргэлтийн явц</h3>
    <div className="mt-3 space-y-3">{order.platform_fulfillment_status && <div className="flex flex-wrap justify-between gap-2 border-t border-[#293C32]/10 pt-3"><span className="font-medium">Платформын илгээмж</span><span className="text-[#42634F]">{order.status === "cancelled" ? "Цуцлагдсан" : FULFILLMENT_LABEL[order.platform_fulfillment_status]}</span></div>}{fulfillments.map((fulfillment, index) => <div key={fulfillment.store_id} className="border-t border-[#293C32]/10 pt-3">
      <div className="flex flex-wrap justify-between gap-2"><span className="font-medium">Илгээмж {index + 1}</span><span className="text-[#42634F]">{order.status === "cancelled" ? "Цуцлагдсан" : FULFILLMENT_LABEL[fulfillment.status]}</span></div>
      <p className="mt-1 text-xs text-[#6C726B]">{fulfillment.items.map(item => `${item.name} × ${item.qty}`).join(" · ")}</p>
      {admin && <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6C726B]"><div>Бараа {formatPrice(fulfillment.subtotal)}</div><div>Шимтгэл {formatPrice(fulfillment.platform_fee ?? 0)} ({(fulfillment.commission_bps ?? 0) / 100}%)</div><div>Дэлгүүрийн дүн {formatPrice(fulfillment.merchant_net ?? fulfillment.subtotal)}</div></dl>}
    </div>)}</div>
  </section>;
}

export function AdminOrderOperations({ order, paymentState, onUpdated }: { order: CommerceOrder; paymentState?: string; onUpdated: () => Promise<void> }) {
  const cancellation = order.order_cancellations;
  const [action, setAction] = useState<"approve" | "reject" | "record_refund">("approve");
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const owner = useAuth(state => state.user?.id);
  const refund = cancellation?.status === "approved" && paymentState === "paid";
  const actionable = cancellation?.status === "requested" || refund;
  const nextPlatformStatus = order.platform_fulfillment_status === "pending" ? "processing" : order.platform_fulfillment_status === "processing" ? "shipped" : order.platform_fulfillment_status === "shipped" ? "delivered" : null;
  return <details className="mt-4 rounded-xl border border-[#293C32]/15 bg-[#F8F7F3] p-4 text-sm">
    <summary className="cursor-pointer font-medium"><ClipboardList size={15} className="mr-2 inline" />Худалдааны хяналт{cancellation && ` · ${CANCELLATION_LABEL[cancellation.status]}`}</summary>
    <div className="mt-4 space-y-4">
      <OrderFulfillmentSummary order={order} admin />
      {nextPlatformStatus && order.status !== "pending_payment" && order.status !== "cancelled" && cancellation?.status !== "requested" && <form className="space-y-3 rounded-xl border bg-white p-4" onSubmit={async event => {
        event.preventDefault();
        if (pending.current || !owner) return;
        pending.current = true; setBusy(true); setError(null);
        try {
          const response = await authFetch(`/api/admin/orders/${order.id}/fulfillment`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextPlatformStatus, expectedStatus: order.platform_fulfillment_status }) }, owner);
          const result = await response.json();
          if (!response.ok) throw new Error(result.error ?? "Хүргэлтийн төлөв хадгалагдсангүй.");
          if (useAuth.getState().user?.id === owner) await onUpdated();
        } catch (issue) { if (useAuth.getState().user?.id === owner) setError(issue instanceof Error ? issue.message : "Хүргэлтийн төлөв хадгалагдсангүй."); }
        finally { pending.current = false; setBusy(false); }
      }}>
        <p className="font-medium">Платформын барааны хүргэлт</p>
        <label className="flex items-start gap-2 text-xs"><input required type="checkbox" className="mt-0.5" />Бодит явцыг шалгаж, дараах төлөвт шилжүүлнэ: {FULFILLMENT_LABEL[nextPlatformStatus]}.</label>
        <button className="btn-ghost" disabled={busy}>{busy ? "Хадгалж байна…" : FULFILLMENT_LABEL[nextPlatformStatus]}</button>
      </form>}
      {cancellation ? <CancellationSummary cancellation={cancellation} paid={paymentState === "paid"} /> : <p className="text-[#6C726B]">Цуцлах хүсэлт ирээгүй.</p>}
      {actionable && <form className="space-y-3 border-t pt-4" onSubmit={async event => {
        event.preventDefault();
        if (pending.current || !owner) return;
        pending.current = true; setBusy(true); setError(null);
        try {
          const response = await authFetch(`/api/admin/orders/${order.id}/cancellation`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: refund ? "record_refund" : action, note, ...(refund ? { reference, amount: Number(amount), externalRefundConfirmed: true } : action === "approve" ? { externalPaymentChecked: true } : {}) }) }, owner);
          const result = await response.json();
          if (!response.ok) throw new Error(result.error ?? "Шийдвэр хадгалагдсангүй.");
          if (useAuth.getState().user?.id === owner) await onUpdated();
        } catch (issue) { if (useAuth.getState().user?.id === owner) setError(issue instanceof Error ? issue.message : "Шийдвэр хадгалагдсангүй."); }
        finally { pending.current = false; setBusy(false); }
      }}>
        {refund ? <p className="font-medium text-[#9A5B20]">Энэ товч мөнгө шилжүүлэхгүй. Банк/төлбөрийн системд хийсэн бүрэн буцаалтыг баримтаар бүртгэнэ.</p> : <label className="block">Шийдвэр<select className="input mt-1" value={action} onChange={event => setAction(event.target.value as "approve" | "reject")}><option value="approve">Цуцлалтыг зөвшөөрөх</option><option value="reject">Хүсэлтийг зөвшөөрөхгүй</option></select></label>}
        <label className="block">Шийдвэрийн тайлбар<textarea className="input mt-1 min-h-20" minLength={5} maxLength={1000} required value={note} onChange={event => setNote(event.target.value)} /></label>
        {refund && <><label className="block">Буцаалтын гүйлгээний дугаар<input className="input mt-1" minLength={3} maxLength={100} required value={reference} onChange={event => setReference(event.target.value)} /></label><label className="block">Бодитоор буцаасан дүн (₮)<input className="input mt-1" type="number" step="1" min={order.total} max={order.total} required value={amount} onChange={event => setAmount(event.target.value)} /></label><p className="text-xs">Энэ урсгал бүрэн буцаалт: {formatPrice(order.total)}. Хэсэгчилсэн буцаалт энд дэмжигдээгүй.</p></>}
        {(refund || action === "approve") && <label className="flex items-start gap-2 text-xs"><input key={refund ? "refund" : "approval"} type="checkbox" required className="mt-0.5" />{refund ? "Бодит буцаалтын дүн, гүйлгээний баримтыг тулгаж шалгасан." : "Төлбөрийн систем/дансны хуулга болон хүргэлтийн явцыг шалгасан. Давхар төлбөр, гарсан илгээмж байхгүй."}</label>}
        <button className="btn-primary" disabled={busy}>{busy ? <><RefreshCw size={14} className="animate-spin" />Хадгалж байна…</> : refund ? "Бодит буцаалтыг бүртгэх" : "Шийдвэр хадгалах"}</button>
      </form>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {!!order.commerce_order_events?.length && <div className="border-t pt-3"><h4 className="font-medium">Үйлдлийн бүртгэл</h4><ol className="mt-2 space-y-2 text-xs text-[#6C726B]">{order.commerce_order_events.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 12).map(event => <li key={event.id}><span>{formatDateTime(event.created_at)}</span><p className="break-words">{event.event}</p></li>)}</ol></div>}
    </div>
  </details>;
}
