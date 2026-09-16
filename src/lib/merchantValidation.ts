import type { Category, Store } from "./types";
import { CATEGORY_LABEL } from "./products";
import { CatalogInputError, parseProduct } from "./catalogValidation";

export function merchantObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CatalogInputError("Мэдээллийн бүтэц буруу байна.");
  return value as Record<string, unknown>;
}

export function parseMerchantStore(value: unknown) {
  const raw = merchantObject(value);
  const text = (key: string, max: number, optional = false): string => {
    const value = raw[key];
    if (typeof value !== "string" || value.length > max || (!optional && !value.trim())) throw new CatalogInputError("Дэлгүүрийн мэдээллээ бүрэн, зөв оруулна уу.");
    return value.trim();
  };
  const storeType = text("storeType", 20);
  if (!["factory", "handmade", "retail"].includes(storeType)) throw new CatalogInputError("Дэлгүүрийн төрөл буруу байна.");
  if (!Array.isArray(raw.categories) || raw.categories.length > 7 || raw.categories.some(c => typeof c !== "string" || !Object.hasOwn(CATEGORY_LABEL, c))) throw new CatalogInputError("Тавилгын ангилал буруу байна.");
  const image = text("image", 2000, true);
  let validImage = !image || /^\/(?!\/)[^\\\s]+$/.test(image);
  try {
    const url = new URL(image);
    validImage ||= url.protocol === "https:" && !url.username && !url.password && ["images.unsplash.com", "res.cloudinary.com", "i.pravatar.cc"].includes(url.hostname);
  } catch {}
  if (!validImage) throw new CatalogInputError("Зургийн холбоос local, Unsplash эсвэл Cloudinary байх ёстой.");
  return {
    name: text("name", 200), storeType: storeType as Store["storeType"], city: text("city", 100),
    district: text("district", 100, true), address: text("address", 1000), phone: text("phone", 50),
    description: text("description", 5000, true), image, categories: [...new Set(raw.categories)] as Category[],
  };
}

/** Explicit editable fields keep platform ranking, store assignment and models out of this API. */
export function parseMerchantProduct(value: unknown, id: string) {
  const raw = merchantObject(value);
  if (!Number.isSafeInteger(raw.stockQuantity) || Number(raw.stockQuantity) < 0 || Number(raw.stockQuantity) > 1_000_000) throw new CatalogInputError("Нөөцийн тоо 0–1,000,000 хооронд бүхэл тоо байна.");
  return parseProduct({
    id, name: raw.name, category: raw.category, description: raw.description,
    basePrice: raw.basePrice, image: raw.image, images: raw.images,
    colors: raw.colors, materials: raw.materials, defaultColor: raw.defaultColor,
    dimensions: raw.dimensions, stockQuantity: raw.stockQuantity,
    rating: 0, reviewCount: 0, badges: [], isNew: false, isBestSeller: false, storeIds: [],
  });
}
