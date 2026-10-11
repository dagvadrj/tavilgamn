import { parseSpecifications } from "./productSpecifications";
import type { Product } from "./types";
import { CATEGORY_LABEL } from "./catalogCategories";
import { MAX_STOCK_QUANTITY } from "./inventory";
import { parseModelColors, parseModelMaterials } from "./modelOptions";

export class CatalogInputError extends Error {}

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export function parseProduct(value: unknown): Product {
  if (!record(value)) {
    throw new CatalogInputError("Барааны мэдээлэл буруу байна.");
  }

  const text = (value: unknown, max: number, empty = false): string => {
    if (
      typeof value !== "string" ||
      (!empty && !value.trim()) ||
      value.length > max
    ) {
      throw new CatalogInputError("Текстийн утга буруу байна.");
    }

    return value.trim();
  };

  const integer = (value: unknown, max = Number.MAX_SAFE_INTEGER): number => {
    if (
      typeof value !== "number" ||
      !Number.isSafeInteger(value) ||
      value < 0 ||
      value > max
    ) {
      throw new CatalogInputError("Үнэ эсвэл тоо буруу байна.");
    }

    return value;
  };

  const bool = (value: unknown): boolean => {
    if (typeof value !== "boolean") {
      throw new CatalogInputError("Төлөв буруу байна.");
    }

    return value;
  };

  const id = text(value.id, 100);

  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new CatalogInputError("Барааны ID буруу байна.");
  }

  const category = text(value.category, 30);

  if (!Object.hasOwn(CATEGORY_LABEL, category)) {
    throw new CatalogInputError("Ангилал буруу байна.");
  }

  const imageUrl = (raw: unknown): string => {
    const image = text(raw, 2000);
    const localImage = /^\/(?!\/)[^\\\s]+$/.test(image);
    let remoteImage = false;

    try {
      const url = new URL(image);
      remoteImage =
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        ["images.unsplash.com", "res.cloudinary.com", "i.pravatar.cc"].includes(
          url.hostname,
        );
    } catch {}

    if (!localImage && !remoteImage) {
      throw new CatalogInputError(
        "Зургийн URL нь local зам, Unsplash эсвэл Cloudinary байх ёстой.",
      );
    }
    return image;
  };
  const image = imageUrl(value.image);
  if (
    value.images != null &&
    (!Array.isArray(value.images) || value.images.length > 12)
  ) {
    throw new CatalogInputError("Нэмэлт зураг 12-оос олонгүй байна.");
  }
  const images = [...new Set((value.images ?? []).map(imageUrl))].filter(
    (item) => item !== image,
  );

  let colors: Product["colors"];
  let materials: Product["materials"];

  try {
    colors = parseModelColors(JSON.stringify(value.colors));
    materials = parseModelMaterials(JSON.stringify(value.materials));
  } catch {
    throw new CatalogInputError("Өнгө, материалын сонголт буруу байна.");
  }

  if (colors.length > 50 || materials.length > 20) {
    throw new CatalogInputError("Сонголтын тоо хэт олон байна.");
  }

  const basePrice = integer(value.basePrice);
  const compareAtPrice =
    value.compareAtPrice == null ? null : integer(value.compareAtPrice);
  if (compareAtPrice != null && compareAtPrice <= basePrice) {
    throw new CatalogInputError("Лавлах үнэ худалдах үнээс өндөр байх ёстой.");
  }
  const promotionLabel =
    value.promotionLabel == null || value.promotionLabel === ""
      ? null
      : text(value.promotionLabel, 80);
  const deliveryTerms =
    value.deliveryTerms == null || value.deliveryTerms === ""
      ? null
      : text(value.deliveryTerms, 1000);
  let promotionEndsAt: string | null = null;
  if (value.promotionEndsAt != null && value.promotionEndsAt !== "") {
    if (
      typeof value.promotionEndsAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(
        value.promotionEndsAt,
      ) ||
      !Number.isFinite(Date.parse(value.promotionEndsAt))
    ) {
      throw new CatalogInputError("Урамшууллын дуусах огноо буруу байна.");
    }
    promotionEndsAt = new Date(value.promotionEndsAt).toISOString();
  }
  if (compareAtPrice == null && (promotionLabel || promotionEndsAt)) {
    throw new CatalogInputError("Урамшууллын лавлах үнийг эхлээд оруулна уу.");
  }

  for (const color of colors) {
    for (const material of materials) {
      const price = basePrice + (color.priceDelta ?? 0) + material.priceDelta;

      if (
        color.id.length > 100 ||
        color.name.length > 200 ||
        material.name.length > 200 ||
        !Number.isSafeInteger(color.priceDelta ?? 0) ||
        !Number.isSafeInteger(material.priceDelta) ||
        !Number.isSafeInteger(price) ||
        price < 0
      ) {
        throw new CatalogInputError(
          "Өнгө, материалын нэмэлт үнэ бүхэл төгрөг байх ёстой.",
        );
      }
    }
  }

  const defaultColor = text(value.defaultColor, 100);

  if (!colors.some((color) => color.id === defaultColor)) {
    throw new CatalogInputError("Үндсэн өнгө сонголтод алга.");
  }

  if (!record(value.dimensions)) {
    throw new CatalogInputError("Хэмжээ шаардлагатай.");
  }

  const dimension = (value: unknown): number => {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value <= 0 ||
      value > 100
    ) {
      throw new CatalogInputError("Хэмжээ 0–100 метрийн хооронд байна.");
    }

    return value;
  };

  const strings = (value: unknown, max: number) => {
    if (!Array.isArray(value) || value.length > max) {
      throw new CatalogInputError("Жагсаалт буруу байна.");
    }

    return [...new Set(value.map((item) => text(item, 100)))];
  };

  if (
    typeof value.rating !== "number" ||
    !Number.isFinite(value.rating) ||
    value.rating < 0 ||
    value.rating > 5
  ) {
    throw new CatalogInputError("Үнэлгээ 0–5 байна.");
  }

  let specifications: Product["specifications"];
  if (value.specifications !== undefined) {
    try {
      specifications = parseSpecifications(value.specifications);
    } catch (error) {
      throw new CatalogInputError(
        error instanceof Error ? error.message : "Үзүүлэлт буруу байна.",
      );
    }
  }

  return {
    ...(specifications === undefined ? {} : { specifications }),
    id,
    name: text(value.name, 200),
    category: category as Product["category"],
    description: text(value.description, 10000, true),
    image,
    images,
    basePrice,
    compareAtPrice,
    promotionLabel,
    promotionEndsAt,
    deliveryTerms,
    colors,
    materials,
    defaultColor,
    dimensions: {
      w: dimension(value.dimensions.w),
      d: dimension(value.dimensions.d),
      h: dimension(value.dimensions.h),
    },
    stockQuantity:
      value.stockQuantity == null
        ? null
        : integer(value.stockQuantity, MAX_STOCK_QUANTITY),
    inStock:
      value.stockQuantity != null &&
      integer(value.stockQuantity, MAX_STOCK_QUANTITY) > 0,
    isNew: bool(value.isNew ?? false),
    isBestSeller: bool(value.isBestSeller ?? false),
    rating: value.rating,
    reviewCount: integer(value.reviewCount),
    badges: strings(value.badges ?? [], 10),
    storeIds: strings(value.storeIds ?? [], 100),
  };
}
