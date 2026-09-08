export type PaymentMethod = "qpay" | "socialpay" | "bank_transfer";
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  qpay: "QPay", socialpay: "SocialPay", bank_transfer: "Банкны шилжүүлэг",
};
export interface PaymentInstructions {
  method: PaymentMethod;
  qrImage?: string;
  url?: string;
  bank?: { name: string; account: string; holder: string; reference: string };
}
export interface PaymentView {
  method: PaymentMethod;
  state: "creating" | "ready" | "needs_review" | "paid";
  instructions: PaymentInstructions | null;
}
export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === "qpay" || value === "socialpay" || value === "bank_transfer";
}
