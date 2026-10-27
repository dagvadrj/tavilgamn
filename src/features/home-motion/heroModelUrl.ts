import type { Product } from "@/lib/types";

// Match BOTH immutable model id and filename. A new admin selection must never
// accidentally display the old hero derivative. Catalog files remain untouched.
const derivatives: Record<string, string> = {
  "62e41d60-85fe-4a7b-be7b-9bb184796bad/model-05e38299-7a01-4664-8f7d-6f511e5341f6.glb":
    "/interior/hybrid/sofa.glb",
};
export function heroModelUrl(product?: Product) {
  if (!product?.model) return undefined;
  const key = `${product.model.id}/${product.model.file}`;
  return derivatives[key] || `/api/models/files/${key}`;
}
