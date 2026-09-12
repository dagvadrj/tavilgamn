import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { cloudinaryModelAsset } from "@/lib/cloudinaryModels";
import { r2ModelKey, r2DownloadUrl } from "@/lib/r2Models";
import { modelAssetPaths } from "@/lib/modelAssets";
export const dynamic = "force-dynamic";
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string; filename: string[] } },
) {
  const headers = { "Cache-Control": "no-store" };
  if (!/^[0-9a-f-]{36}$/i.test(params.id) || params.filename.length !== 1 ||
      !/^[a-zA-Z0-9._-]+$/.test(params.filename[0]) ||
      [".", ".."].includes(params.filename[0])) {
    return NextResponse.json({ error: "Файлын зам буруу байна." }, { status: 400, headers });
  }
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db.from("furniture_models")
      .select("glb_path,thumbnail_path").eq("id", params.id).maybeSingle();
    if (error) throw error;
    const path = [...(typeof data?.glb_path === "string" ? modelAssetPaths(data.glb_path) : []), data?.thumbnail_path].find(
      (value): value is string => typeof value === "string" && value.split("/").pop() === params.filename[0],
    );
    if (!path) {
      return NextResponse.json({ error: "Файл олдсонгүй." }, { status: 404, headers });
    }
    let destination: string;
    if (r2ModelKey(path)) destination = await r2DownloadUrl(path);
    else if (cloudinaryModelAsset(path)) destination = path;
    else if (path === `${params.id}/${params.filename[0]}`) {
      destination = db.storage.from("furniture-models").getPublicUrl(path).data.publicUrl;
    } else throw new Error("Invalid stored file path");
    return NextResponse.redirect(destination, { status: 307, headers: r2ModelKey(path) && process.env.R2_PUBLIC_BASE_URL
      ? { "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=60" } : headers });
  } catch {
    return NextResponse.json({ error: "Файлыг ачаалж чадсангүй." }, { status: 503, headers });
  }
}
