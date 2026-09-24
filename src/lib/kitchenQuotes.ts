import { CatalogInputError } from "./catalogValidation";

export type KitchenQuoteStatus =
  | "submitted"
  | "reviewing"
  | "quoted"
  | "closed";

const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CatalogInputError("Үнийн хүсэлтийн мэдээлэл буруу байна.");
  }
  return value as Record<string, unknown>;
}

function uuid(value: unknown, message: string) {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new CatalogInputError(message);
  }
  return value;
}

function text(value: unknown, min: number, max: number, message: string) {
  if (typeof value !== "string") throw new CatalogInputError(message);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new CatalogInputError(message);
  }
  return trimmed;
}

function dimension(value: unknown, min: number, max: number) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new CatalogInputError("Өрөөний хэмжээ буруу байна.");
  }
  return value;
}

export function readKitchenQuoteRequest(designId: string, value: unknown) {
  const input = object(value);
  const email = text(input.email, 3, 254, "Имэйл хаяг буруу байна.").toLowerCase();
  if (!EMAIL.test(email)) throw new CatalogInputError("Имэйл хаяг буруу байна.");

  const projectId = input.projectId == null
    ? null
    : uuid(input.projectId, "Гал тогооны төслийн ID буруу байна.");

  const roomValues = [input.roomWidthMm, input.roomDepthMm, input.roomHeightMm];
  const hasRoom = roomValues.some((item) => item != null);
  if (hasRoom && roomValues.some((item) => item == null)) {
    throw new CatalogInputError("Өрөөний өргөн, урт, өндрийг бүрэн оруулна уу.");
  }

  return {
    designId: uuid(designId, "Гал тогооны загварын ID буруу байна."),
    projectId,
    idempotencyKey: uuid(input.idempotencyKey, "Хүсэлтийн ID буруу байна."),
    contact: {
      name: text(input.name, 2, 100, "Холбоо барих нэр буруу байна."),
      phone: text(input.phone, 4, 50, "Утасны дугаар буруу байна."),
      email,
    },
    room: hasRoom
      ? {
          widthMm: dimension(input.roomWidthMm, 1000, 20000),
          depthMm: dimension(input.roomDepthMm, 1000, 20000),
          heightMm: dimension(input.roomHeightMm, 2000, 5000),
        }
      : {},
    message: text(input.message ?? "", 0, 3000, "Нэмэлт тайлбар хэт урт байна."),
  };
}

export function readMerchantKitchenQuoteUpdate(value: unknown) {
  const input = object(value);
  const allowed = new Set<KitchenQuoteStatus>([
    "submitted",
    "reviewing",
    "quoted",
    "closed",
  ]);
  if (typeof input.status !== "string" || !allowed.has(input.status as KitchenQuoteStatus)) {
    throw new CatalogInputError("Үнийн хүсэлтийн төлөв буруу байна.");
  }
  if (
    typeof input.expectedStatus !== "string" ||
    !allowed.has(input.expectedStatus as KitchenQuoteStatus)
  ) {
    throw new CatalogInputError("Үнийн хүсэлтийн өмнөх төлөв буруу байна.");
  }

  const quotedPrice = input.quotedPrice == null ? null : input.quotedPrice;
  if (
    quotedPrice !== null &&
    (typeof quotedPrice !== "number" ||
      !Number.isSafeInteger(quotedPrice) ||
      quotedPrice < 0)
  ) {
    throw new CatalogInputError("Үнийн санал бүхэл төгрөгөөр байна.");
  }
  if (input.status === "quoted" && quotedPrice === null) {
    throw new CatalogInputError("Үнийн дүнгээ оруулна уу.");
  }

  return {
    id: uuid(input.id, "Үнийн хүсэлтийн ID буруу байна."),
    status: input.status as KitchenQuoteStatus,
    expectedStatus: input.expectedStatus as KitchenQuoteStatus,
    quotedPrice,
    note: text(input.note ?? "", 0, 5000, "Merchant-ийн тайлбар хэт урт байна."),
  };
}
