import { apiErrorResponse, privateHeaders } from "./api/errors";
import { isRecord, OrderInputError } from "./orderValidation";

export const orderOperationsHeaders = privateHeaders;
export const ORDER_UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

function text(value: unknown, label: string, min = 5, max = 1000): string {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) {
    throw new OrderInputError(`${label} ${min}–${max} тэмдэгт байна.`);
  }
  return value.trim();
}

export function parseCancellationRequest(value: unknown) {
  if (!isRecord(value)) throw new OrderInputError("Цуцлах хүсэлтийн бүтэц буруу байна.");
  return { reason: text(value.reason, "Шалтгаан") };
}

export function parseCancellationResolution(value: unknown) {
  if (!isRecord(value) || !["approve", "reject", "record_refund"].includes(String(value.action))) {
    throw new OrderInputError("Цуцлах хүсэлтийн үйлдлээ сонгоно уу.");
  }
  const action = value.action as "approve" | "reject" | "record_refund";
  const note = text(value.note, "Шалгалтын тэмдэглэл");
  if (action === "approve" && value.externalPaymentChecked !== true) {
    throw new OrderInputError("Төлбөрийн үйлчилгээ болон хүргэлтийн төлөвийг шалгаснаа баталгаажуулна уу.");
  }
  if (action === "record_refund") {
    if (value.externalRefundConfirmed !== true || !Number.isSafeInteger(value.amount) || (value.amount as number) <= 0) {
      throw new OrderInputError("Гадаад төлбөрийн үйлчилгээнд бүтэн буцаалт хийгдсэнийг баталгаажуулж, бодит дүнг оруулна уу.");
    }
    return { action, note, reference: text(value.reference, "Буцаалтын гүйлгээний дугаар", 3, 100), amount: value.amount as number };
  }
  return { action, note, reference: null, amount: null };
}

export function orderOperationsError(error: unknown) {
  const code = isRecord(error) ? error.code : null;
  const status = error instanceof OrderInputError ? error.status
    : code === "42501" ? 403 : code === "P0002" ? 404 : ["P0016", "23505"].includes(String(code)) ? 409
    : code === "22023" ? 400 : 503;
  const message = error instanceof OrderInputError ? error.message
    : status === 403 ? "Энэ захиалгыг өөрчлөх эрхгүй байна."
    : status === 404 ? "Захиалга эсвэл цуцлах хүсэлт олдсонгүй."
    : status === 409 ? "Захиалга, төлбөр эсвэл хүргэлтийн төлөв өөрчлөгдсөн байна. Дахин ачаалж шалгана уу."
    : "Захиалгын үйлдэл түр боломжгүй байна.";
  return apiErrorResponse({ error: message }, { status, headers: orderOperationsHeaders });
}
