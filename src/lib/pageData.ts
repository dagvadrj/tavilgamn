import type { Product, Store } from "./types";
import type { KitchenDesignSummary } from "./kitchenMarketplace";

export type PageData = {
  home: {
    catalog: Product[];
    stores: Store[];
    paymentLabels: string[];
    homepageProductIds?: string[];
    homepageJourneyProducts?: { bedProductId?: string | null; wardrobeProductId?: string | null };
  };
  stores: { directory: Store[]; productCounts: Record<string, number> };
  store: { store: Store; products: Product[] };
  product: { product: Product; related: Product[] };
  kitchens: { designs: KitchenDesignSummary[] };
  kitchen: { design: KitchenDesignSummary };
};
