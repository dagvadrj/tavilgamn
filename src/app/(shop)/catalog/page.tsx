import { CatalogView } from "@/components/CatalogView";
import { CATEGORIES } from "@/lib/products";
import { readCachedProducts } from "@/lib/publicCatalog";
import { parseProduct } from "@/lib/catalogValidation";
import { withTimeout } from "@/lib/withTimeout";
import type { Product } from "@/lib/types";

export const metadata = { title: "Каталог — tavilga.mn" };

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; focus?: string; sort?: string; room?: string; offers?: string; category?: string }>;
}) {
  const filters = await searchParams;
  // Products in the first HTML, so their photos (the LCP) start loading at
  // once. A slow or failed read falls back to the client fetch and its retry.
  const initialProducts: Product[] | undefined = await withTimeout(
    readCachedProducts(),
    3000,
    "Catalog",
  )
    .then((products) =>
      products.map((product) => ({
        ...parseProduct(product),
        ...(product.model ? { model: product.model } : {}),
      })),
    )
    .catch(() => undefined);
  return (
    <CatalogView
      initialProducts={initialProducts}
      initialCategory={CATEGORIES.find(category => category.id === filters.category)?.id}
      initialQuery={filters.q ?? (filters.focus ? "" : undefined)}
      initialSort={filters.sort}
      initialRoom={filters.room}
      initialOffers={filters.offers === "1"}
    />
  );
}
