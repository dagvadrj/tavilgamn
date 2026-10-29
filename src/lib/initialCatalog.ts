import type { Product } from "./types";

/**
 * A server-rendered page passes the products it rendered with. They stand in
 * until the client store has loaded, so the first HTML already lists products
 * (and their photos load early) and hydration matches it, without the server
 * ever writing to the module-level store that every request would share.
 */
export function withInitialCatalog<
  T extends { ready: boolean; loading: boolean; products: Product[] },
>(catalog: T, initial?: Product[]): T {
  if (catalog.ready || !initial) return catalog;
  return { ...catalog, products: initial, ready: true, loading: false };
}
