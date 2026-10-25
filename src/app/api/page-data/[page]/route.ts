import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api/errors";
import { readProduct } from "@/lib/catalogServer";
import {
  readCachedProducts,
  readCachedStoreDirectory,
  readCachedDirectoryStore,
  readCachedStoreProductCounts,
} from "@/lib/publicCatalog";
import {
  readPublishedKitchenDesigns,
  readPublishedKitchenDesignBySlug,
} from "@/lib/kitchenMarketplaceServer";
import { configuredPaymentLabels } from "@/lib/paymentPresentationServer";
import { hasAvailableStock } from "@/lib/inventory";
import type { PageData } from "@/lib/pageData";
import { readHomepageSettings } from "@/lib/homepageSettingsServer";
import { defaultHomepageSettings } from "@/lib/homepageSettings";
import { DEFAULT_HOMEPAGE_HERO, homepageStatistics } from "@/lib/homepagePresentation";
import { readHomepageMaterialCount, readHomepageMaterialSwatches } from "@/lib/homepageStatisticsServer";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

function json<K extends keyof PageData>(page: K, data: PageData[K]) {
  return NextResponse.json(data, { headers });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ page: string }> },
) {
  const { page } = await params;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const missing = () =>
    apiErrorResponse(
      { error: "Таны хүссэн мэдээлэл олдсонгүй." },
      { status: 404, headers },
    );
  try {
    switch (page) {
      case "home": {
        const [catalog, stores, scene, materialCount, swatches] = await Promise.all([
          readCachedProducts(),
          readCachedStoreDirectory(),
          readHomepageSettings().catch(() => defaultHomepageSettings()),
          readHomepageMaterialCount().catch(() => null),
          readHomepageMaterialSwatches().catch(() => []),
        ]);
        return json(page, {
          catalog,
          stores,
          paymentLabels: configuredPaymentLabels(),
          homepageProductIds: scene.productIds,
          homepageJourneyProducts: { bedProductId: scene.bedProductId, wardrobeProductId: scene.wardrobeProductId },
          homepageHero: scene.hero ?? DEFAULT_HOMEPAGE_HERO,
          homepageMaterialSwatches: swatches,
          homepageStatistics: homepageStatistics(catalog, stores, materialCount),
        });
      }
      case "stores": {
        const [directory, counts] = await Promise.all([
          readCachedStoreDirectory(),
          readCachedStoreProductCounts(),
        ]);
        return json(page, {
          directory,
          productCounts: Object.fromEntries(counts),
        });
      }
      case "store": {
        if (!id || id.length > 100) return missing();
        const store = await readCachedDirectoryStore(id);
        if (!store) return missing();
        const products = (await readCachedProducts()).filter(
          (product) =>
            hasAvailableStock(product) && product.storeIds?.includes(store.id),
        );
        return json(page, { store, products });
      }
      case "product": {
        if (!id || id.length > 100) return missing();
        const product = await readProduct(id);
        if (!product || !hasAvailableStock(product)) return missing();
        const related = (await readCachedProducts())
          .filter(
            (item) =>
              hasAvailableStock(item) &&
              item.category === product.category &&
              item.id !== product.id,
          )
          .slice(0, 4);
        return json(page, { product, related });
      }
      case "kitchens":
        return json(page, { designs: await readPublishedKitchenDesigns() });
      case "kitchen": {
        if (!id || id.length > 100) return missing();
        const design = await readPublishedKitchenDesignBySlug(id);
        if (!design) return missing();
        return json(page, { design });
      }
      default:
        return missing();
    }
  } catch {
    return apiErrorResponse(
      { error: "Мэдээллийг ачаалж чадсангүй. Дахин оролдоно уу." },
      { status: 503, headers },
    );
  }
}
