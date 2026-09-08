import { NextResponse } from "next/server";
import { paymentConfigured } from "@/lib/payments/providers";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/lib/payments";
export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json(Object.entries(PAYMENT_METHOD_LABEL).map(([id, name]) => ({
    id, name, available: paymentConfigured(id as PaymentMethod),
  })), { headers: { "Cache-Control": "no-store" } });
}
