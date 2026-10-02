import type { OrderRecord } from "./orders";

export type CancellationStatus = "requested" | "approved" | "rejected" | "refunded";
export interface OrderCancellation {
  order_id: string;
  reason: string;
  status: CancellationStatus;
  requested_at: string;
  reviewed_at: string | null;
  review_note: string | null;
  refund_reference: string | null;
  refunded_at: string | null;
}
export interface OrderFulfillment {
  store_id: string;
  status: "pending" | "processing" | "shipped" | "delivered";
  items: OrderRecord["items"];
  subtotal: number;
  commission_bps?: number;
  platform_fee?: number;
  merchant_net?: number;
}
export interface CommerceOrderDetails {
  order_cancellations?: OrderCancellation | null;
  merchant_order_fulfillments?: OrderFulfillment[];
  platform_fulfillment_status?: OrderFulfillment["status"] | null;
  commerce_order_events?: { id: string; event: string; created_at: string; details: unknown }[];
}
export const CANCELLATION_LABEL: Record<CancellationStatus, string> = {
  requested: "Цуцлах хүсэлтийг шалгаж байна",
  approved: "Цуцлалтыг зөвшөөрсөн",
  rejected: "Цуцлах хүсэлтийг зөвшөөрөөгүй",
  refunded: "Төлбөрийн буцаалт бүртгэгдсэн",
};
export const FULFILLMENT_LABEL: Record<OrderFulfillment["status"], string> = {
  pending: "Бэлтгэл хүлээж буй",
  processing: "Бэлтгэж буй",
  shipped: "Хүргэлтэд гарсан",
  delivered: "Хүргэгдсэн",
};
export function canRequestCancellation(order: OrderRecord & CommerceOrderDetails) {
  return ["pending_payment", "paid", "processing"].includes(order.status) && !order.order_cancellations;
}
export function cancellationBlocksPayment(order: CommerceOrderDetails) {
  return !!order.order_cancellations && order.order_cancellations.status !== "rejected";
}
