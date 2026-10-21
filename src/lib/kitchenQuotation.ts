import { CatalogInputError } from "./catalogValidation";
export type QuotationLine = {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
};
export type KitchenCommerce = {
  projectName: string;
  storeName: string;
  document: {
    quote_id: string;
    items: QuotationLine[];
    total: number;
    note: string;
    created_at: string;
  } | null;
  appointment: {
    engineer: string;
    starts_at: string;
    ends_at: string;
    status: "proposed" | "confirmed" | "declined";
    version: number;
  } | null;
};
export function quotationLineTotal(item: QuotationLine) {
  return Math.round((Math.round(item.quantity * 100) * item.unitPrice) / 100);
}
export function quotationTotal(items: QuotationLine[]) {
  const total = items.reduce((n, item) => n + quotationLineTotal(item), 0);
  if (!Number.isSafeInteger(total) || total < 0)
    throw new CatalogInputError("Үнийн саналын дүн хэт их байна.");
  return total;
}
export function parseQuotationLines(value: unknown): QuotationLine[] {
  if (!Array.isArray(value) || !value.length || value.length > 50)
    throw new CatalogInputError("1–50 мөрөөр үнэ оруулна уу.");
  return value.map((item) => {
    if (
      !item ||
      typeof item.name !== "string" ||
      !item.name.trim() ||
      item.name.length > 200 ||
      typeof item.unit !== "string" ||
      !item.unit.trim() ||
      item.unit.length > 20 ||
      typeof item.quantity !== "number" ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      item.quantity > 10000 ||
      Math.abs(item.quantity * 100 - Math.round(item.quantity * 100)) >
        0.000001 ||
      !Number.isSafeInteger(item.unitPrice) ||
      item.unitPrice < 0 ||
      item.unitPrice > 1_000_000_000
    )
      throw new CatalogInputError(
        "Мөр бүрийн нэр, тоо хэмжээ, нэгж үнийг зөв оруулна уу.",
      );
    return {
      name: item.name.trim(),
      quantity: item.quantity,
      unit: item.unit.trim(),
      unitPrice: item.unitPrice,
    };
  });
}
