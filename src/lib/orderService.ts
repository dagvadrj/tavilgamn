import "server-only";
import { parseModelColors, parseModelMaterials } from "./modelOptions";
import { OrderInputError } from "./orderValidation";
import { shippingFor, type OrderQuote, type OrderSelection } from "./orders";
import { getSupabaseAdmin } from "./supabase/admin";
import { productFromRow, FURNITURE_FIELDS, type FurnitureRow } from "./catalogServer";
import { availableStock } from "./inventory";

export async function quoteOrder(
  items: OrderSelection[],
  supabase = getSupabaseAdmin(),
): Promise<OrderQuote> {
  const ids = [
    ...new Set(items.map((item) => item.productId)),
  ];

  const { data, error } = await supabase
    .from("furniture_models")
    .select(FURNITURE_FIELDS)
    .in("product_id", ids);

  if (error) throw error;

  const products = new Map(
    (data ?? []).map((row) => {
      const product = productFromRow(row as FurnitureRow);
      return [product.id, product] as const;
    }),
  );

  const quantities = new Map<string, number>();
  for (const item of items) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.qty);
  const lines = items.map((item) => {
    const product = products.get(item.productId);

    if (!product) {
      throw new OrderInputError(
        "Сагсны зарим бараа устгагдсан байна.",
        409,
      );
    }

    if (!product.inStock) {
      throw new OrderInputError(
        `${product.name}: нөөцгүй байна.`,
        409,
      );
    }

    if ((quantities.get(product.id) ?? 0) > availableStock(product)) {
      throw new OrderInputError(`${product.name}: үлдэгдэл ${availableStock(product)} ширхэг байна. Сагсны тоог бууруулна уу.`, 409);
    }

    const color = product.colors.find(
      (option) => option.id === item.color,
    );

    const material = product.materials.find(
      (option) => option.id === item.material,
    );

    if (!color || !material) {
      throw new OrderInputError(
        "Өнгө эсвэл материалын сонголт өөрчлөгдсөн. Барааг дахин сонгоно уу.",
        409,
      );
    }

    const unitPrice = Math.round(
      product.basePrice +
        (color.priceDelta ?? 0) +
        material.priceDelta,
    );

    if (
      !Number.isSafeInteger(unitPrice) ||
      unitPrice < 0 ||
      !Number.isSafeInteger(unitPrice * item.qty)
    ) {
      throw new Error("Invalid catalog price");
    }

    return {
      ...item,
      name: product.name,
      colorName: color.name,
      materialName: material.name,
      unitPrice,
      lineTotal: unitPrice * item.qty,
      stockQuantity: availableStock(product),
    };
  });

  const subtotal = lines.reduce(
    (sum, line) => sum + line.lineTotal,
    0,
  );

  const shipping = shippingFor(subtotal);
  const total = subtotal + shipping;

  if (!Number.isSafeInteger(total)) {
    throw new OrderInputError(
      "Захиалгын нийт дүн хэт их байна.",
    );
  }

  return { items: lines, subtotal, shipping, total };
}
