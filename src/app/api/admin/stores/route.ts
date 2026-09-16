import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { readStoreDirectory } from "@/lib/storeDirectory";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    return NextResponse.json({ stores: await readStoreDirectory({ includeInactive: true }) }, { headers });
  } catch {
    return NextResponse.json({ error: "Дэлгүүрүүдийг ачаалж чадсангүй." }, { status: 503, headers });
  }
}
