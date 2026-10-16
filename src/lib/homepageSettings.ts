import { HOME_PRODUCT_IDS } from "@/features/home-interior/homeStory";

export type HomepageSettings = { productIds: string[]; version: number };
export const defaultHomepageSettings = (): HomepageSettings => ({
  productIds: [...HOME_PRODUCT_IDS],
  version: 0,
});

export function parseHomepageSettings(value: unknown): HomepageSettings | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (
    !Array.isArray(input.productIds) ||
    input.productIds.length !== 2 ||
    !input.productIds.every(
      (id) =>
        typeof id === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          id,
        ),
    ) ||
    input.productIds[0] === input.productIds[1] ||
    !Number.isSafeInteger(input.version) ||
    Number(input.version) < 0
  )
    return null;
  return { productIds: [...input.productIds], version: Number(input.version) };
}
