import { NextRequest, NextResponse } from "next/server";
import { readPublishedKitchenDesigns } from "@/lib/kitchenMarketplaceServer";
import { kitchenDesignMatchesSearch } from "@/lib/kitchenListingSuggestions";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const headers = { "Cache-Control": "no-store" };
  if (query.length > 120)
    return NextResponse.json(
      { error: "Хайлтын үг хэт урт байна." },
      { status: 400, headers },
    );
  if (!query) return NextResponse.json({ designs: [], total: 0 }, { headers });
  try {
    const designs = (await readPublishedKitchenDesigns()).filter((design) =>
      kitchenDesignMatchesSearch(design, query),
    );
    return NextResponse.json(
      {
        designs: designs.slice(0, 4).map((design) => ({
          id: design.id,
          slug: design.slug,
          title: design.title,
          storeName: design.storeName,
          thumbnailUrl: design.thumbnailUrl,
          tags: design.tags,
        })),
        total: designs.length,
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { error: "Гал тогооны хайлтыг ачаалж чадсангүй." },
      { status: 503, headers },
    );
  }
}
