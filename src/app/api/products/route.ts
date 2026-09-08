import { NextResponse } from "next/server";
import { readProducts } from "@/lib/catalogServer";

export const dynamic = "force-dynamic";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };

  try {
    return NextResponse.json(
      { products: await readProducts() },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { error: "Тавилгын мэдээллийг ачаалж чадсангүй." },
      { status: 503, headers },
    );
  }
}