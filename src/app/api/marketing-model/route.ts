import { NextResponse } from "next/server";
import { readCachedProducts } from "@/lib/publicCatalog";
import { readKitchenModuleCatalog } from "@/lib/kitchenModuleCatalogServer";
import { createCatalogCache } from "@/lib/catalogCache";
import { marketingProduct, type MarketingModel } from "@/lib/marketingModel";
import { apiErrorResponse } from "@/lib/api/errors";
import { readHomepageMaterialSwatches } from "@/lib/homepageStatisticsServer";

export const dynamic = "force-dynamic";
const kitchen = createCatalogCache(async (): Promise<MarketingModel | null> => {
  const [modules, swatches] = await Promise.all([
    readKitchenModuleCatalog(),
    readHomepageMaterialSwatches().catch(() => []),
  ]);
  for (const cabinet of modules) {
    const variant = cabinet.variants.find(
      (item) =>
        item.active && item.processingStatus === "ready" && item.glbFile,
    );
    if (!cabinet.active || !variant) continue;
    return {
      id: variant.furnitureModelId,
      file: variant.previewGlbFile || variant.glbFile!,
      name: cabinet.name,
      image: variant.thumbnailUrl ?? "",
      colors: swatches.map((item) => item.color),
      dimensions: {
        w: cabinet.widthMm / 1000,
        d: cabinet.depthMm / 1000,
        h: cabinet.heightMm / 1000,
      },
    };
  }
  return null;
}, 60_000);

export async function GET(request: Request) {
  try {
    const kind = new URL(request.url).searchParams.get("kind");
    if (kind !== "room" && kind !== "kitchen")
      return apiErrorResponse({ error: "Төрөл буруу байна." }, { status: 400 });
    const model =
      kind === "kitchen"
        ? (await kitchen.get()).value
        : marketingProduct(
            (await readCachedProducts()).find((product) => product.model),
          );
    if (!model)
      return apiErrorResponse(
        { error: "Нийтэд үзүүлэх 3D загвар хараахан алга." },
        { status: 404 },
      );
    return NextResponse.json(
      { model },
      { headers: { "Cache-Control": "public, max-age=15" } },
    );
  } catch {
    return apiErrorResponse(
      { error: "3D үзүүлбэр түр боломжгүй." },
      { status: 503 },
    );
  }
}
