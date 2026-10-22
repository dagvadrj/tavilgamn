import { CatalogInputError } from "./catalogValidation";
import type { Json } from "./supabase/database.types";

export type StaffRole = "sales" | "warehouse" | "driver";
export type WorkspaceAccess = {
  role: "owner" | StaffRole;
  storeId: string;
  storeName: string;
  ownerId: string;
  driverId?: string;
};
export const STAFF_LABEL: Record<StaffRole, string> = {
  sales: "Борлуулагч",
  warehouse: "Агуулахын нярав",
  driver: "Хүргэлтийн жолооч",
};
export const READ_OPERATIONS = new Set([
  "branches",
  "staff",
  "reviews",
  "cases",
  "assistant",
  "risk",
  "orders",
]);
const fail = (): never => {
  throw new CatalogInputError(
    "Мэдээлэл дутуу эсвэл буруу байна. Талбаруудаа шалгана уу.",
  );
};
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : fail();
const text = (v: unknown, min: number, max: number) =>
  typeof v === "string" && v.trim().length >= min && v.length <= max
    ? v.trim()
    : fail();
const integer = (v: unknown, max = 1000000) =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max
    ? v
    : fail();
const bool = (v: unknown) => (typeof v === "boolean" ? v : fail());
const choice = (v: unknown, values: string[]) =>
  typeof v === "string" && values.includes(v) ? v : fail();
export const operationUuid = (v: unknown) =>
  typeof v === "string" &&
  /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v)
    ? v
    : fail();

export function parseOperation(action: string, value: unknown): Json {
  const d = object(value);
  if (READ_OPERATIONS.has(action)) {
    const result: Record<string, Json> = { page: integer(d.page ?? 0, 100000) };
    if (action === "branches") result.search = text(d.search ?? "", 0, 100);
    if (action === "reviews")
      result.status = choice(d.status ?? "", [
        "",
        "pending",
        "approved",
        "rejected",
      ]);
    if (action === "risk" && d.date) {
      const date = text(d.date, 10, 10);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date
      )
        fail();
      result.date = date;
    }
    return result;
  }
  const identity = () => ({
    id: operationUuid(d.id),
    version: integer(d.version),
  });
  switch (action) {
    case "branch":
      return {
        ...(d.id ? identity() : {}),
        name: text(d.name, 2, 100),
        address: text(d.address ?? "", 0, 500),
        kind: choice(d.kind, ["showroom", "warehouse"]),
        active: bool(d.active ?? true),
      };
    case "allocate":
      return {
        branchId: operationUuid(d.branchId),
        productId: text(d.productId, 1, 150),
        quantity: integer(d.quantity),
        expectedQuantity: integer(d.expectedQuantity),
        expectedTotal: integer(d.expectedTotal),
      };
    case "member": {
      const role = choice(d.role, ["sales", "warehouse", "driver"]);
      const email = d.id ? "" : text(d.email, 3, 254);
      if (!d.id && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail();
      return {
        ...(d.id ? identity() : { email }),
        name: text(d.name, 2, 100),
        role,
        driverId: role === "driver" ? operationUuid(d.driverId) : "",
        active: bool(d.active ?? true),
      };
    }
    case "review":
      return {
        ...identity(),
        status: choice(d.status, ["pending", "approved", "rejected"]),
        reply: text(d.reply ?? "", 0, 2000),
      };
    case "case":
      return {
        ...identity(),
        status: choice(d.status, [
          "reviewing",
          "returned",
          "resolved",
          "rejected",
        ]),
        reply: text(d.reply, 5, 2000),
      };
    case "save_assistant": {
      if (!Array.isArray(d.faqs) || d.faqs.length > 30) fail();
      return {
        version: integer(d.version),
        enabled: bool(d.enabled),
        greeting: text(d.greeting, 1, 500),
        fallback: text(d.fallback, 5, 500),
        faqs: (d.faqs as unknown[]).map((faq) => {
          const f = object(faq);
          return {
            question: text(f.question, 3, 300),
            answer: text(f.answer, 3, 2000),
          };
        }),
      };
    }
    default:
      return fail();
  }
}
export function parseFeedback(action: string, value: unknown): Json {
  const d = object(value),
    base = {
      orderId: operationUuid(d.orderId),
      storeId: text(d.storeId, 1, 200),
    };
  if (!Array.isArray(d.photos) || d.photos.length > 4) fail();
  const photos = (d.photos as unknown[]).map((p) => {
    const url = text(p, 1, 2048);
    if (!url.startsWith("https://res.cloudinary.com/")) fail();
    return url;
  });
  if (action === "review") {
    const rating = integer(d.rating, 5);
    if (!rating) fail();
    return {
      ...base,
      photos,
      productId: text(d.productId, 1, 150),
      rating,
      body: text(d.body, 5, 2000),
    };
  }
  if (action === "case")
    return {
      ...base,
      photos,
      kind: choice(d.kind, ["return", "complaint"]),
      reason: text(d.reason, 5, 2000),
    };
  return fail();
}

export type Faq = { question: string; answer: string };
export function feedbackFormMode(
  requested: string,
  canReview: boolean,
  canCase: boolean,
): "review" | "case" {
  if (requested === "case" && canCase) return "case";
  return canReview ? "review" : "case";
}
export function answerFaq(question: string, faqs: Faq[], fallback: string) {
  const normalize = (s: string) =>
    s
      .toLocaleLowerCase("mn-MN")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 2);
  const q = normalize(question);
  let best = 0,
    answer = fallback;
  for (const faq of faqs) {
    const words = normalize(faq.question),
      hits = q.filter((w) => words.includes(w)).length;
    const score = hits / Math.max(1, new Set([...q, ...words]).size);
    if (hits >= Math.min(2, words.length) && score > best && score >= 0.3) {
      best = score;
      answer = faq.answer;
    }
  }
  return answer;
}
