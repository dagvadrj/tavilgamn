import { CATEGORY_LABEL } from "./catalogCategories";
import type { Product } from "./types";

const aliases: Record<string, string> = {
  couch: "sofa", buidan: "sofa", buydan: "sofa", буйдан: "sofa",
  ор: "bed", or: "bed", shiree: "table", ширээ: "table",
  shkaf: "wardrobe", шкаф: "wardrobe", sandal: "chair", сандал: "chair",
};
const normalize = (value: string) => value.toLocaleLowerCase("mn").normalize("NFKC").trim();

/** Match names, descriptions and category labels, including common English/Latin queries. */
export function matchesProductSearch(product: Pick<Product, "name" | "description" | "category">, query: string) {
  const text = normalize(`${product.name} ${product.description} ${CATEGORY_LABEL[product.category]} ${product.category}`);
  const words = text.split(/[^\p{L}\p{N}-]+/u);
  return normalize(query).split(/\s+/).filter(Boolean).every(term => {
    if (aliases[term] ? words.includes(term) : text.includes(term)) return true;
    const canonical = aliases[term] ?? term;
    if (text.includes(canonical)) return true;
    return Object.entries(aliases).some(([alias, value]) => value === canonical && words.includes(alias));
  });
}

export function searchProducts(products: Product[], query: string) {
  if (!query.trim()) return [];
  const name = normalize(query);
  return products.filter(product => matchesProductSearch(product, query)).sort((a, b) =>
    Number(normalize(b.name).startsWith(name)) - Number(normalize(a.name).startsWith(name)) ||
    Number(normalize(b.name).includes(name)) - Number(normalize(a.name).includes(name)),
  );
}
