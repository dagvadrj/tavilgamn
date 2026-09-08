import type { DeliveryAddress, OrderSelection } from "./orders";

export class OrderInputError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseSelections(value: unknown): OrderSelection[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new OrderInputError("Сагсанд 1–100 нэр төрлийн тавилга байх ёстой.");
  }
  const selections = new Map<string, OrderSelection>();
  for (const item of value) {
    if (!isRecord(item) ||
      typeof item.productId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(item.productId) ||
      typeof item.color !== "string" || !item.color.trim() || item.color.length > 100 ||
      typeof item.material !== "string" || !["wood", "metal", "fabric", "leather", "velvet"].includes(item.material) ||
      !Number.isInteger(item.qty) || (item.qty as number) < 1 || (item.qty as number) > 99) {
      throw new OrderInputError("Барааны сонголт эсвэл тоо ширхэг буруу байна (1–99).");
    }
    const key = JSON.stringify([item.productId, item.color, item.material]);
    const qty = (selections.get(key)?.qty ?? 0) + (item.qty as number);
    if (qty > 99) throw new OrderInputError("Нэг сонголтын тоо ширхэг 99-өөс их байж болохгүй.");
    selections.set(key, { productId: item.productId, color: item.color, material: item.material as OrderSelection["material"], qty });
  }
  return [...selections.entries()].sort(([a], [b]) => a.localeCompare(b, "en")).map(([, item]) => item);
}

export function parseDelivery(value: unknown): DeliveryAddress {
  if (!isRecord(value)) throw new OrderInputError("Хүргэлтийн мэдээллээ оруулна уу.");
  const { name, phone, address } = value;
  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100 ||
    typeof phone !== "string" || !/^\+?[0-9 ()-]{8,24}$/.test(phone.trim()) ||
    phone.replace(/\D/g, "").length < 8 || phone.replace(/\D/g, "").length > 15 ||
    typeof address !== "string" || address.trim().length < 10 || address.trim().length > 500) {
    throw new OrderInputError("Хүлээн авагчийн нэр, утас, дэлгэрэнгүй хаягаа зөв оруулна уу.");
  }
  return { name: name.trim(), phone: phone.trim(), address: address.trim() };
}

export function parseOrderBody(value: unknown) {
  if (!isRecord(value) || typeof value.idempotencyKey !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.idempotencyKey) ||
    !Number.isSafeInteger(value.expectedTotal) || (value.expectedTotal as number) < 0) {
    throw new OrderInputError("Захиалгын хүсэлт буруу байна. Үнийг дахин шалгана уу.");
  }
  return {
    items: parseSelections(value.items),
    delivery: parseDelivery(value.delivery),
    expectedTotal: value.expectedTotal as number,
    idempotencyKey: value.idempotencyKey,
  };
}
