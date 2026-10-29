import { notFound } from "next/navigation";
import { readCachedDirectoryStore, readCachedProducts } from "@/lib/publicCatalog";
import { hasAvailableStock } from "@/lib/inventory";
import { withTimeout } from "@/lib/withTimeout";
import { StoreContent } from "./StorePageClient";

/** Reads the store and its products on the server; route prefetch never runs this. */
export async function StorePage({ id, verified = false }: { id: string; verified?: boolean }) {
  if (!id || id.length > 100) notFound();
  const [store, catalog] = await withTimeout(
    Promise.all([readCachedDirectoryStore(id), readCachedProducts()]),
    8000,
    "Store",
  );
  if (!store) notFound();
  const products = catalog.filter(
    (product) => hasAvailableStock(product) && product.storeIds?.includes(store.id),
  );
  return <StoreContent store={store} products={products} verified={verified} />;
}
