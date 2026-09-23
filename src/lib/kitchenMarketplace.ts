export const KITCHEN_DESIGN_REVIEW_STATUSES = [
  "draft",
  "submitted",
  "changes_requested",
  "approved",
  "rejected",
] as const;

export type KitchenDesignReviewStatus =
  (typeof KITCHEN_DESIGN_REVIEW_STATUSES)[number];
export type KitchenPublicationStatus =
  | "draft"
  | "published"
  | "archived"
  | "suspended";

export type KitchenDesignSummary = {
  id: string;
  storeId: string;
  storeName: string;
  slug: string;
  publicationStatus: KitchenPublicationStatus;
  publishedVersionId: string | null;
  versionId: string;
  versionNo: number;
  reviewStatus: KitchenDesignReviewStatus;
  title: string;
  shortDescription: string;
  description: string;
  style: string;
  layout: string;
  tags: string[];
  pricingMode: "fixed" | "from" | "quote";
  priceFrom: number | null;
  leadTimeDays: number | null;
  installationIncluded: boolean;
  warrantyMonths: number | null;
  serviceAreas: string[];
  inclusions: string[];
  exclusions: string[];
  cabinetCount: number;
  roomWidthMm: number;
  roomDepthMm: number;
  maxHeightMm: number;
  thumbnailUrl: string | null;
  media: Array<{ id: string; kind: "thumbnail" | "render" | "ai_render" | "photo" | "plan"; source: "system" | "merchant" | "ai"; url: string; altText: string; isPrimary: boolean }>;
  updatedAt: string;
};

export class KitchenMarketplaceInputError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

function text(value: unknown, name: string, max: number, optional = false) {
  if (optional && (value === undefined || value === null || value === "")) return "";
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new KitchenMarketplaceInputError(`${name} буруу байна.`);
  }
  return value.trim();
}

function optionalInteger(value: unknown, name: string, min: number, max: number) {
  if (value === undefined || value === null || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new KitchenMarketplaceInputError(`${name} буруу байна.`);
  }
  return number;
}

function stringList(value: unknown, name: string, maxItems: number) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new KitchenMarketplaceInputError(`${name} буруу байна.`);
  }
  const result = value.map((item) => text(item, name, 100));
  if (new Set(result).size !== result.length) {
    throw new KitchenMarketplaceInputError(`${name} давхардсан байна.`);
  }
  return result;
}

export function kitchenDesignSlug(title: string) {
  const slug = title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return `${slug || "kitchen"}-${crypto.randomUUID().slice(0, 8)}`;
}

export function parseKitchenMarketplaceDraft(value: unknown) {
  if (!record(value)) throw new KitchenMarketplaceInputError("Загварын мэдээлэл буруу байна.");
  const sourceKitchenId = text(value.sourceKitchenId, "Эх загвар", 36);
  if (!UUID.test(sourceKitchenId)) {
    throw new KitchenMarketplaceInputError("Эх загварын ID буруу байна.");
  }
  const title = text(value.title, "Загварын нэр", 160);
  const pricingMode = value.pricingMode ?? "quote";
  if (!(["fixed", "from", "quote"] as unknown[]).includes(pricingMode)) {
    throw new KitchenMarketplaceInputError("Үнийн төрөл буруу байна.");
  }
  const priceFrom = optionalInteger(value.priceFrom, "Үнэ", 0, Number.MAX_SAFE_INTEGER);
  if (pricingMode !== "quote" && priceFrom === null) {
    throw new KitchenMarketplaceInputError("Үнэ оруулна уу.");
  }
  const style = text(value.style ?? "modern", "Загварын стиль", 50);
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(style)) {
    throw new KitchenMarketplaceInputError("Загварын стиль буруу байна.");
  }
  return {
    sourceKitchenId,
    title,
    slug: kitchenDesignSlug(title),
    payload: {
      title,
      shortDescription: text(value.shortDescription, "Товч тайлбар", 300, true),
      description: text(value.description, "Дэлгэрэнгүй тайлбар", 10000, true),
      style,
      tags: stringList(value.tags, "Tag", 20),
      pricingMode,
      priceFrom,
      leadTimeDays: optionalInteger(value.leadTimeDays, "Үйлдвэрлэх хугацаа", 1, 365),
      installationIncluded: value.installationIncluded === true,
      warrantyMonths: optionalInteger(value.warrantyMonths, "Баталгаат хугацаа", 0, 120),
      serviceAreas: stringList(value.serviceAreas, "Үйлчилгээний бүс", 50),
      inclusions: stringList(value.inclusions, "Багтсан зүйл", 50),
      exclusions: stringList(value.exclusions, "Багтаагүй зүйл", 50),
    },
  };
}

export function readKitchenDesignAction(value: unknown) {
  if (!record(value) || typeof value.action !== "string") {
    throw new KitchenMarketplaceInputError("Үйлдэл буруу байна.");
  }
  if (!["submit", "publish", "archive"].includes(value.action)) {
    throw new KitchenMarketplaceInputError("Үйлдэл буруу байна.");
  }
  const versionId = text(value.versionId, "Version", 36, value.action === "archive");
  if (versionId && !UUID.test(versionId)) {
    throw new KitchenMarketplaceInputError("Version ID буруу байна.");
  }
  return { action: value.action as "submit" | "publish" | "archive", versionId };
}

export function readKitchenReview(value: unknown) {
  if (!record(value) || !(["approved", "changes_requested", "rejected", "unpublished"] as unknown[]).includes(value.action)) {
    throw new KitchenMarketplaceInputError("Review үйлдэл буруу байна.");
  }
  const designId = text(value.designId, "Design", 36);
  const versionId = value.action === "unpublished" ? "" : text(value.versionId, "Version", 36);
  if (!UUID.test(designId) || (versionId && !UUID.test(versionId))) {
    throw new KitchenMarketplaceInputError("Design эсвэл version ID буруу байна.");
  }
  return {
    designId,
    versionId: versionId || null,
    action: value.action as "approved" | "changes_requested" | "rejected" | "unpublished",
    note: text(value.note, "Review тайлбар", 5000, true),
  };
}
