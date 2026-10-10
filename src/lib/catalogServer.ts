import "server-only";
import type { Product } from "./types";
import { getSupabaseAdmin } from "./supabase/admin";
import { parseProduct } from "./catalogValidation";
import type { Tables } from "./supabase/database.types";

export const FURNITURE_ORDER_FIELDS =
  "id,product_id,name,category,description,base_price,image_url,thumbnail_path,glb_path,preview_glb_path,processing_status,scale,dimensions_w,dimensions_d,dimensions_h,colors,materials,default_color,in_stock,rating,review_count,badges,is_new,is_best_seller,store_ids";
const FURNITURE_LEGACY_FIELDS = `${FURNITURE_ORDER_FIELDS},images,glb_validation`;
const FURNITURE_COMMERCE_FIELDS = `${FURNITURE_LEGACY_FIELDS},compare_at_price,promotion_label,promotion_ends_at,delivery_terms`;
export const FURNITURE_FIELDS = `${FURNITURE_COMMERCE_FIELDS},specifications`;
export type FurnitureRow = Pick<
  Tables<"furniture_models">,
  | "id"
  | "product_id"
  | "name"
  | "category"
  | "description"
  | "base_price"
  | "image_url"
  | "thumbnail_path"
  | "glb_path"
  | "processing_status"
  | "scale"
  | "dimensions_w"
  | "dimensions_d"
  | "dimensions_h"
  | "colors"
  | "materials"
  | "default_color"
  | "in_stock"
  | "rating"
  | "review_count"
  | "badges"
  | "is_new"
  | "is_best_seller"
  | "store_ids"
> &
  Partial<
    Pick<
      Tables<"furniture_models">,
      | "images"
      | "preview_glb_path"
      | "glb_validation"
      | "compare_at_price"
      | "promotion_label"
      | "promotion_ends_at"
      | "delivery_terms"
      | "specifications"
    >
  >;

export function productFromRow(row: FurnitureRow): Product {
  // Boolean stock means the schema migration has not been applied yet.
  if (row.in_stock != null && typeof row.in_stock !== "number")
    throw new Error("Inventory migration is required");
  const thumbnail = row.thumbnail_path?.split("/").pop();
  const firstColor = Array.isArray(row.colors) ? row.colors[0] : null;
  const fallbackColor =
    firstColor && typeof firstColor === "object" && !Array.isArray(firstColor)
      ? firstColor.id
      : undefined;
  const product = parseProduct({
    id: row.product_id,
    name: row.name,
    category: row.category,
    description: row.description,
    basePrice: Number(row.base_price),
    image:
      row.image_url ||
      (thumbnail
        ? `/api/models/files/${row.id}/${thumbnail}`
        : "/public/image.png"),
    compareAtPrice:
      row.compare_at_price == null ? null : Number(row.compare_at_price),
    promotionLabel: row.promotion_label,
    promotionEndsAt: row.promotion_ends_at,
    deliveryTerms: row.delivery_terms,
    images: row.images ?? [],
    specifications: row.specifications,
    colors: row.colors,
    materials: row.materials,
    defaultColor: row.default_color ?? fallbackColor,
    dimensions: {
      w: Number(row.dimensions_w),
      d: Number(row.dimensions_d),
      h: Number(row.dimensions_h),
    },
    stockQuantity: row.in_stock,
    rating: Number(row.rating ?? 0),
    reviewCount: row.review_count ?? 0,
    badges: row.badges ?? [],
    isNew: row.is_new ?? false,
    isBestSeller: row.is_best_seller ?? false,
    storeIds: row.store_ids ?? [],
  });
  if (row.glb_path && row.processing_status === "ready") {
    const file = row.glb_path.split("/").pop()!;
    const previewFile = row.preview_glb_path?.split("/").pop();
    if (
      !/^[0-9a-f-]{36}$/i.test(row.id) ||
      !/^[a-zA-Z0-9._-]+$/.test(file) ||
      (previewFile && !/^[a-zA-Z0-9._-]+$/.test(previewFile)) ||
      !Number.isFinite(Number(row.scale)) ||
      Number(row.scale) <= 0
    )
      throw new Error("Invalid model reference");
    product.model = {
      id: row.id,
      file,
      ...(previewFile ? { previewFile } : {}),
      scale: Number(row.scale),
      physicalSize:
        row.category === "kitchen-cabinet" && Boolean(row.glb_validation),
    };
  }
  return product;
}

export async function readProducts(
  db = getSupabaseAdmin(),
): Promise<Product[]> {
  const readWithFields = async (fields: string) => {
    const products: Product[] = [];
    let after = "";
    for (;;) {
      let query = db
        .from("furniture_models")
        .select(fields)
        .is("archived_at", null)
        .order("id")
        .limit(500);
      if (after) query = query.gt("id", after);
      const { data, error } = await query;
      if (error) throw error;
      if (!data?.length) return products;
      const rows = data as unknown as FurnitureRow[];
      products.push(...rows.map(productFromRow));
      if (rows.length < 500) return products;
      after = rows[rows.length - 1].id;
    }
  };

  try {
    return await readWithFields(FURNITURE_FIELDS);
  } catch (error) {
    if (isMissingOptionalColumn(error, ["specifications"])) {
      try {
        return await readWithFields(FURNITURE_COMMERCE_FIELDS);
      } catch (commerceError) {
        if (!isMissingOptionalColumn(commerceError)) throw commerceError;
      }
    } else if (!isMissingOptionalColumn(error)) throw error;
    try {
      return await readWithFields(FURNITURE_LEGACY_FIELDS);
    } catch (legacyError) {
      if (!isMissingOptionalColumn(legacyError, ["images", "glb_validation"]))
        throw legacyError;
      return readWithFields(FURNITURE_ORDER_FIELDS);
    }
  }
}

function isMissingOptionalColumn(
  error: unknown,
  columns = [
    "images",
    "glb_validation",
    "compare_at_price",
    "promotion_label",
    "promotion_ends_at",
    "delivery_terms",
  ],
) {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; message?: string };
  return (
    ["42703", "PGRST204"].includes(value.code ?? "") &&
    columns.some((column) => value.message?.includes(column))
  );
}

export async function readProduct(
  id: string,
  db = getSupabaseAdmin(),
): Promise<Product | undefined> {
  const readWithFields = async (fields: string) => {
    const { data, error } = await db
      .from("furniture_models")
      .select(fields)
      .is("archived_at", null)
      .eq("product_id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? productFromRow(data as unknown as FurnitureRow) : undefined;
  };

  try {
    return await readWithFields(FURNITURE_FIELDS);
  } catch (error) {
    if (isMissingOptionalColumn(error, ["specifications"])) {
      try {
        return await readWithFields(FURNITURE_COMMERCE_FIELDS);
      } catch (commerceError) {
        if (!isMissingOptionalColumn(commerceError)) throw commerceError;
      }
    } else if (!isMissingOptionalColumn(error)) throw error;
    try {
      return await readWithFields(FURNITURE_LEGACY_FIELDS);
    } catch (legacyError) {
      if (!isMissingOptionalColumn(legacyError, ["images", "glb_validation"]))
        throw legacyError;
      return readWithFields(FURNITURE_ORDER_FIELDS);
    }
  }
}
