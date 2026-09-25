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
      .select("glb_path,source_glb_path,thumbnail_path").eq("id", params.id).maybeSingle();
    if (error) throw error;
    const path = [
      ...(typeof data?.source_glb_path === "string" ? [data.source_glb_path] : []),
      ...(typeof data?.glb_path === "string" ? modelAssetPaths(data.glb_path) : []),
      data?.thumbnail_path,
    ].find(
      (value): value is string => typeof value === "string" && value.split("/").pop() === params.filename[0],
    );
    if (!path) {
      return NextResponse.json({ error: "Файл олдсонгүй." }, { status: 404, headers });
    }
    if (r2ModelKey(path)) {
      const upstream = await fetch(await r2DownloadUrl(path), {
        cache: "no-store",
        signal: AbortSignal.timeout(120000),
      });
      if (!upstream.ok || !upstream.body) throw new Error(`R2 model fetch failed (${upstream.status})`);
      const responseHeaders = new Headers({
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=60",
        "Content-Type": upstream.headers.get("content-type") ?? "model/gltf-binary",
        "X-Content-Type-Options": "nosniff",
      });
      for (const name of ["content-length", "etag", "last-modified"]) {
        const value = upstream.headers.get(name);
        if (value) responseHeaders.set(name, value);
      }
      return new NextResponse(upstream.body, { status: 200, headers: responseHeaders });
    }
    let destination: string;
    if (cloudinaryModelAsset(path)) destination = path;
    else if (path === `${params.id}/${params.filename[0]}`) {
      destination = db.storage.from("furniture-models").getPublicUrl(path).data.publicUrl;
    } else throw new Error("Invalid stored file path");
    return NextResponse.redirect(destination, { status: 307, headers });
  } catch (error) {
    console.error("[model file]", params.id, params.filename[0], error);
    return NextResponse.json({ error: "Файлыг ачаалж чадсангүй." }, { status: 503, headers });
  }
}
