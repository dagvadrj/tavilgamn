import "server-only";
import { createCatalogCache } from "./catalogCache";
import {
  readPublishedKitchenDesignBySlug,
  readPublishedKitchenDesigns,
} from "./kitchenMarketplaceServer";

// Published kitchen designs are public, approved content read in three
// dependent round trips (~0.6 s). Like the product listing, they are served
// from a 15 s snapshot; concurrent visitors share one read.
type Designs = Awaited<ReturnType<typeof readPublishedKitchenDesigns>>;
const worker = globalThis as typeof globalThis & {
  __tavilgaPublicKitchens?: ReturnType<typeof createCatalogCache<Designs>>;
};
const persist =
  process.env.NODE_ENV === "development" ||
  process.env.NODE_ENV === "production";
const designs =
  (persist && worker.__tavilgaPublicKitchens) ||
  createCatalogCache<Designs>(() => readPublishedKitchenDesigns());
if (persist) worker.__tavilgaPublicKitchens = designs;

export const readCachedKitchenDesigns = async () => (await designs.get()).value;

/** A listed design comes from the snapshot; anything else is read directly. */
export async function readCachedKitchenDesignBySlug(slug: string) {
  const listed = (await readCachedKitchenDesigns().catch(() => [])).find(
    (design) => design.slug === slug,
  );
  return listed ?? readPublishedKitchenDesignBySlug(slug);
}
