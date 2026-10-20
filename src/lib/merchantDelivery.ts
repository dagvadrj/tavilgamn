import type { DeliveryAddress, OrderLine } from "./orders";

export const DELIVERY_STAGES = [
  "incoming",
  "preparing",
  "prepared",
  "shipped",
  "delivered",
  "completed",
] as const;
export type DeliveryStage = (typeof DELIVERY_STAGES)[number];
export const DELIVERY_STAGE_LABEL: Record<DeliveryStage, string> = {
  incoming: "Ирсэн захиалга",
  preparing: "Бэлтгэх",
  prepared: "Бэлтгэгдсэн тавилга",
  shipped: "Хүргэлтэд гарсан",
  delivered: "Хүргэгдсэн",
  completed: "Захиалга дууссан",
};
export const DELIVERY_NEXT: Partial<Record<DeliveryStage, DeliveryStage>> = {
  incoming: "preparing",
  preparing: "prepared",
  prepared: "shipped",
  shipped: "delivered",
  delivered: "completed",
};
export type DeliveryStaff = {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  active: boolean;
  version: number;
};
export type AssignedDeliveryStaff = Pick<
  DeliveryStaff,
  "id" | "name" | "phone" | "vehicle"
>;
export type MerchantDeliveryOrder = {
  readOnly?: boolean;
  id: string;
  items: OrderLine[];
  subtotal: number;
  delivery: DeliveryAddress;
  stage: DeliveryStage;
  version: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  paymentStatus: "pending_payment" | "paid";
  cancellationStatus: string | null;
  driver: AssignedDeliveryStaff | null;
};
export type DeliveryColumn = {
  orders: MerchantDeliveryOrder[];
  hasMore: boolean;
  total: number;
};
export function deliveryBlockReason(
  order: MerchantDeliveryOrder,
): string | null {
  if (order.readOnly) return "Энэ шатанд харах эрхтэй";
  if (order.paymentStatus !== "paid") return "Төлбөр төлөгдөөгүй";
  if (order.cancellationStatus === "requested")
    return "Цуцлах хүсэлтийг шалгаж байна";
  if (!DELIVERY_NEXT[order.stage]) return "Захиалга дууссан";
  return null;
}
export function canMoveDelivery(
  order: MerchantDeliveryOrder,
  target: string,
): boolean {
  return !deliveryBlockReason(order) && DELIVERY_NEXT[order.stage] === target;
}
