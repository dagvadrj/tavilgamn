import type { Category, Product } from "./types";
import { hasAvailableStock } from "./inventory";

export type CatalogFacet = { id: string; label: string; count: number };
const normalize = (value: string) =>
  value.trim().toLocaleLowerCase("mn-MN").replace(/\s+/g, " ");

/** Missing or ambiguous specifications remain unknown, never inferred as false. */
export function sofaConversion(
  value?: string,
): "sleeper" | "fixed" | "unspecified" {
  const text = normalize(value ?? "");
  if (!text) return "unspecified";
  if (
    /^(үгүй|үгүй\.|no|false|0)$/.test(text) ||
    /болдоггүй|болгох боломжгүй|болохгүй|дэлгэдэггүй|non[- ]?convertible|not convertible/.test(
      text,
    )
  )
    return "fixed";
  if (
    /^(тийм|yes|true|1)$/.test(text) ||
    /ор болдог|ор болгох боломжтой|ор болгодог|дэлгэж ор|sofa bed|sleeper|^convertible$/.test(
      text,
    )
  )
    return "sleeper";
  return "unspecified";
}

export function productFacet(product: Product): string {
  if (product.category === "sofa")
    return sofaConversion(product.specifications?.convertible);
  const type = normalize(product.specifications?.type ?? "");
  return type ? `type:${type}` : "unspecified";
}

export function categoryFacets(
  products: Product[],
  category: Category,
): CatalogFacet[] {
  const items = products.filter(
    (product) => product.category === category && hasAvailableStock(product),
  );
  const counts = new Map<string, CatalogFacet>();
  if (category === "sofa") {
    counts.set("sleeper", { id: "sleeper", label: "Ор болдог", count: 0 });
    counts.set("fixed", { id: "fixed", label: "Ор болдоггүй", count: 0 });
  }
  for (const product of items) {
    const id = productFacet(product);
    const label =
      id === "unspecified"
        ? "Төрөл тодорхойгүй"
        : product.specifications?.type?.trim() || id;
    const existing = counts.get(id) ?? { id, label, count: 0 };
    existing.count += 1;
    counts.set(id, existing);
  }
  return [...counts.values()];
}

export function categoryHref(category: Category, facet?: string) {
  return `/catalog/${category}${facet ? `?type=${encodeURIComponent(facet)}` : ""}`;
}
