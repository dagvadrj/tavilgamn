import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/requireUser";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parseKitchen } from "@/lib/kitchenAssembly";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const columns = "id,name,design,created_at,updated_at";
export async function GET(request: NextRequest) {
  const auth = await requireUser(request); if (auth.error) return auth.error;
  const { data, error } = await getSupabaseAdmin().from("kitchen_garnitures").select(columns)
    .eq("user_id", auth.userId).order("updated_at", { ascending: false }).limit(500);
  if (error) return NextResponse.json({ error: "Гарнитурын сан ачаалагдсангүй. Дахин оролдоно уу." }, { status: 503, headers });
  return NextResponse.json({ kitchens: data }, { headers });
}
export async function PUT(request: NextRequest) {
  const auth = await requireUser(request); if (auth.error) return auth.error;
  try {
    const text = await request.text(); if (text.length > 250000) return NextResponse.json({ error: "Загварын өгөгдөл хэт том байна." }, { status: 413, headers });
    const body = JSON.parse(text);
    if (!body || typeof body !== "object") throw new Error("Гарнитурын өгөгдөл буруу байна.");
    if (typeof body.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id) || typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 100) throw new Error("Загварын нэр 1–100 тэмдэгт байна.");
    const design = parseKitchen(body.design);
    // The authenticated owner is never taken from request JSON. Composite key
    // makes another user's ID unable to overwrite or transfer their row.
    const { data, error } = await getSupabaseAdmin().from("kitchen_garnitures").upsert({
      user_id: auth.userId, id: body.id, name: body.name.trim(), design,
    }, { onConflict: "user_id,id" }).select(columns).single();
    if (error) return NextResponse.json({ error: "Хадгалж чадсангүй. Загвар тань редакторт хэвээр байна." }, { status: 503, headers });
    return NextResponse.json({ kitchen: data }, { headers });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Загварын өгөгдөл буруу байна." }, { status: 400, headers }); }
}
export async function DELETE(request: NextRequest) {
  const auth = await requireUser(request); if (auth.error) return auth.error;
  const id = request.nextUrl.searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Загварын ID буруу байна." }, { status: 400, headers });
  const { error } = await getSupabaseAdmin().from("kitchen_garnitures").delete().eq("user_id", auth.userId).eq("id", id);
  return error ? NextResponse.json({ error: "Устгаж чадсангүй." }, { status: 503, headers }) : NextResponse.json({ ok: true }, { headers });
}
