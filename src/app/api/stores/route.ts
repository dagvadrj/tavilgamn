import { NextResponse } from "next/server";
import { readStoreDirectory } from "@/lib/storeDirectory";

export const dynamic = "force-dynamic";
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    return NextResponse.json({ stores: await readStoreDirectory() }, { headers });
  } catch {
    return NextResponse.json({ error: "Дэлгүүрүүдийг ачаалж чадсангүй." }, { status: 503, headers });
  }
}
