import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { isRecord } from "../orderValidation";
import type { PaymentInstructions, PaymentMethod } from "../payments";

export class PaymentConfigError extends Error {}
function env(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new PaymentConfigError("Төлбөрийн энэ арга түр боломжгүй байна.");
  return value;
}
function httpsBase(name: string) {
  const url = new URL(env(name));
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new PaymentConfigError("Төлбөрийн тохиргоо дутуу байна.");
  return url.toString().replace(/\/$/, "");
}
export function paymentConfigured(method: PaymentMethod) {
  try { validatePaymentConfig(method); return true; } catch { return false; }
}
export function validatePaymentConfig(method: PaymentMethod) {
  if (method === "bank_transfer") {
    env("BANK_NAME"); env("BANK_ACCOUNT"); env("BANK_ACCOUNT_HOLDER");
    return;
  }
  httpsBase("APP_URL");
  if (method === "qpay") {
    httpsBase("QPAY_BASE_URL"); env("QPAY_USERNAME"); env("QPAY_PASSWORD"); env("QPAY_INVOICE_CODE");
  } else {
    httpsBase("SOCIALPAY_BASE_URL"); env("SOCIALPAY_BEARER_TOKEN"); env("SOCIALPAY_SECRET");
  }
}

async function post(url: string, authorization: string, body?: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: authorization },
    body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store",
    signal: AbortSignal.timeout(15000), redirect: "error",
  });
  if (!response.ok) throw new Error("Payment provider request failed");
  const result: unknown = await response.json();
  if (!isRecord(result)) throw new Error("Invalid provider response");
  return result;
}

let tokenCache: { key: string; token: string; expiresAt: number } | null = null;
let tokenPending: Promise<string> | null = null;
async function qpayToken() {
  const key = `${httpsBase("QPAY_BASE_URL")}:${env("QPAY_USERNAME")}`;
  if (tokenCache?.key === key && tokenCache.expiresAt > Date.now() + 60000) return tokenCache.token;
  if (tokenPending) return tokenPending;
  tokenPending = (async () => {
    const result = await post(`${httpsBase("QPAY_BASE_URL")}/v2/auth/token`, `Basic ${Buffer.from(`${env("QPAY_USERNAME")}:${env("QPAY_PASSWORD")}`).toString("base64")}`);
    if (typeof result.access_token !== "string" || !result.access_token) throw new Error("Missing provider token");
    // QPay expires_in is a Unix timestamp; support duration-form sandbox responses too.
    const expires = Number(result.expires_in);
    const expiresAt = expires > 1_000_000_000 ? expires * 1000 : Date.now() + (Number.isFinite(expires) && expires > 0 ? expires : 60) * 1000;
    tokenCache = { key, token: result.access_token, expiresAt };
    return result.access_token;
  })();
  try { return await tokenPending; } finally { tokenPending = null; }
}
function sign(value: string) { return createHmac("sha256", env("SOCIALPAY_SECRET")).update(value).digest("hex"); }
function validSignature(value: unknown, expected: string) {
  return typeof value === "string" && /^[0-9a-f]{64}$/i.test(value) && timingSafeEqual(Buffer.from(value, "hex"), Buffer.from(expected, "hex"));
}

export function verifySocialpayNotification(value: unknown): { orderId: string; amount: number } | null {
  if (!isRecord(value) || typeof value.transactionId !== "string" || value.errorCode !== "000" ||
    typeof value.amount !== "string" || !/^\d+(\.\d{1,2})?$/.test(value.amount) ||
    !Number.isSafeInteger(Number(value.amount))) return null;
  const expected = sign(value.transactionId + value.errorCode + value.amount + (typeof value.token === "string" ? value.token : ""));
  return validSignature(value.checksum, expected) ? { orderId: value.transactionId, amount: Number(value.amount) } : null;
}

export async function createPayment(method: PaymentMethod, orderId: string, total: number, callbackToken: string): Promise<{ invoiceId: string; instructions: PaymentInstructions }> {
  validatePaymentConfig(method);
  if (method === "bank_transfer") {
    return { invoiceId: orderId, instructions: { method, bank: { name: env("BANK_NAME"), account: env("BANK_ACCOUNT"), holder: env("BANK_ACCOUNT_HOLDER"), reference: orderId } } };
  }
  const callback = `${httpsBase("APP_URL")}/api/payments/callback/${method}/${orderId}?token=${encodeURIComponent(callbackToken)}`;
  if (method === "qpay") {
    const result = await post(`${httpsBase("QPAY_BASE_URL")}/v2/invoice`, `Bearer ${await qpayToken()}`, {
      invoice_code: env("QPAY_INVOICE_CODE"), sender_invoice_no: orderId,
      invoice_receiver_code: "terminal", invoice_description: `tavilga.mn ${orderId}`,
      amount: total, callback_url: callback, allow_partial: false, allow_exceed: false,
    });
    if (typeof result.invoice_id !== "string" || !result.invoice_id || typeof result.qr_image !== "string" || !/^[a-zA-Z0-9+/=]+$/.test(result.qr_image)) throw new Error("Invalid QPay invoice");
    const shortUrl = typeof result.qPay_shortUrl === "string" && result.qPay_shortUrl.startsWith("https://") ? result.qPay_shortUrl : undefined;
    return { invoiceId: result.invoice_id, instructions: { method, qrImage: `data:image/png;base64,${result.qr_image}`, url: shortUrl } };
  }
  const amount = total.toFixed(2);
  const result = await post(`${httpsBase("SOCIALPAY_BASE_URL")}/api/invoice`, `Bearer ${env("SOCIALPAY_BEARER_TOKEN")}`, {
    transactionId: orderId, amount, returnType: "GET", callback, genToken: "N", socialDeeplink: "N",
    checksum: sign(orderId + amount + "GET" + callback),
  });
  if (typeof result.invoice !== "string" || !result.invoice || result.transactionId !== orderId || !validSignature(result.checksum, sign(result.invoice + orderId))) throw new Error("Invalid SocialPay invoice signature");
  return { invoiceId: result.invoice, instructions: { method, url: `${httpsBase("SOCIALPAY_BASE_URL")}/socialpay/MN/${encodeURIComponent(result.invoice)}` } };
}

// Called after a provider callback, never by a cron/polling loop.
export async function verifyPayment(method: PaymentMethod, orderId: string, invoiceId: string, total: number): Promise<string | null> {
  if (method === "bank_transfer") return null;
  if (method === "qpay") {
    const result = await post(`${httpsBase("QPAY_BASE_URL")}/v2/payment/check`, `Bearer ${await qpayToken()}`, {
      object_type: "INVOICE", object_id: invoiceId, offset: { page_number: 1, page_limit: 100 },
    });
    if (!Array.isArray(result.rows)) throw new Error("Invalid payment response");
    const paid = result.rows.filter((row) => isRecord(row) && row.payment_status === "PAID" && row.payment_currency === "MNT");
    // Partial payments are disabled: only a single full payment settles this order.
    const full = paid.find((row) => Number(row.payment_amount) === total && typeof row.payment_id === "string");
    return full ? String(full.payment_id) : null;
  }
  const result = await post(`${httpsBase("SOCIALPAY_BASE_URL")}/api/inquiry`, `Bearer ${env("SOCIALPAY_BEARER_TOKEN")}`, {
    transactionId: orderId, checksum: sign(orderId + orderId),
  });
  if (result.errorCode !== "000") return null;
  if (result.transactionId !== orderId || Number(result.amount) !== total ||
    !validSignature(result.checksum, sign(orderId + String(result.errorCode) + String(result.amount) + (typeof result.token === "string" ? result.token : "")))) {
    throw new Error("Invalid SocialPay payment confirmation");
  }
  return orderId;
}
