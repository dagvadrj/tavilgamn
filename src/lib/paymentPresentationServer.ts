import "server-only";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "./payments";
import { paymentConfigured } from "./payments/providers";

/** Share checkout's availability checks without exposing credentials or contacting a provider. */
export function configuredPaymentLabels(): string[] {
  return (Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[])
    .filter(paymentConfigured).map(method => PAYMENT_METHOD_LABEL[method]);
}
