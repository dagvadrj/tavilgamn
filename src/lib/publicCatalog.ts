import "server-only";
import { createCatalogCache } from "./catalogCache";
import { readProducts } from "./catalogServer";
import { readStoreDirectory, readStoreProductCounts } from "./storeDirectory";

// Public listing caches only. Product detail, admin reads and checkout stay fresh.
function createPublicCaches() {
  const readers = { products: readProducts, stores: readStoreDirectory, storeCounts: readStoreProductCounts };
  return {
    readers,
    products: createCatalogCache(() => readers.products()),
    stores: createCatalogCache(() => readers.stores()),
    storeCounts: createCatalogCache(() => readers.storeCounts()),
  };
}
// Next's development renderer reloads server modules between requests. Keep
// the bounded snapshots on the worker, while refreshing their reader functions.
const worker = globalThis as typeof globalThis & { __tavilgaPublicCatalog?: ReturnType<typeof createPublicCaches> };
const persist = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "production";
const caches = (persist && worker.__tavilgaPublicCatalog) || createPublicCaches();
Object.assign(caches.readers, { products: readProducts, stores: readStoreDirectory, storeCounts: readStoreProductCounts });
if (persist) worker.__tavilgaPublicCatalog = caches;
const { products, stores, storeCounts } = caches;

export const readCatalogSnapshot = (force = false) => products.get(force);
export const readCachedProducts = async () => (await readCatalogSnapshot()).value;
export const readCachedStoreDirectory = async () => (await stores.get()).value;
export const readCachedStoreProductCounts = async () => (await storeCounts.get()).value;
export const readCachedDirectoryStore = async (id: string) => (await readCachedStoreDirectory()).find(store => store.id === id);
