export type StoreType = "factory" | "handmade" | "retail";

export const STORE_TYPES: { id: StoreType; label: string; description: string }[] = [
  { id: "factory", label: "Тавилгын үйлдвэр", description: "Захиалгаар тавилга үйлдвэрлэдэг газрууд" },
  { id: "handmade", label: "Гар хийц", description: "Урлаачдын гараар урласан тавилга" },
  { id: "retail", label: "Бэлэн бараа", description: "Бэлэн тавилгатай дэлгүүрүүд" },
];

export function isStoreType(value: unknown): value is StoreType {
  return STORE_TYPES.some(type => type.id === value);
}
