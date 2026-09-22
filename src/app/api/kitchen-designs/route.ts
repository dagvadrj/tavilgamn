import { NextResponse } from "next/server";
import { readPublishedKitchenDesigns } from "@/lib/kitchenMarketplaceServer";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(
      { designs: await readPublishedKitchenDesigns() },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch {
    return NextResponse.json({ error: "Загваруудыг ачаалж чадсангүй." }, { status: 503 });
  }
}
