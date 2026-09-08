import type { Material } from "./types";

export const FREE_SHIPPING_THRESHOLD = 1_500_000;
export const STANDARD_SHIPPING_FEE = 49_000;

export interface OrderSelection {
  productId: string;
  color: string;
  material: Material;
  qty: number;
}

export interface DeliveryAddress {
  name: string;
  phone: string;
  address: string;
}

export interface OrderLine extends OrderSelection {
  stockQuantity?: number;
  name: string;
  colorName: string;
  materialName: string;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderQuote {
  items: OrderLine[];
  subtotal: number;
  shipping: number;
  total: number;
}

export type OrderStatus = "pending_payment" | "paid" | "processing" | "shipped" | "delivered" | "cancelled";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Төлбөр хүлээж буй",
  paid: "Төлбөр төлөгдсөн",
  processing: "Бэлтгэж буй",
  shipped: "Хүргэлтэд гарсан",
  delivered: "Хүргэгдсэн",
  cancelled: "Цуцлагдсан",
};

export interface OrderRecord extends OrderQuote {
  id: string;
  status: OrderStatus;
  currency: "MNT";
  delivery: DeliveryAddress;
  created_at: string;
}

export function shippingFor(subtotal: number): number {
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;
}
