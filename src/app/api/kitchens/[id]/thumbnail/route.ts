import { NextRequest, NextResponse } from "next/server";
import { uploadCloudinaryImage } from "@/lib/cloudinaryImageUpload";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(request); if (auth.error) return auth.error;
  if (!UUID.test(params.id)) return NextResponse.json({ error: "Загварын ID буруу байна." }, { status: 400, headers });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 6_000_000) return NextResponse.json({ error: "Зураг 5MB-аас их байна." }, { status: 413, headers });
  const db = getSupabaseAdmin();
  const { data: kitchen, error: readError } = await db.from("kitchen_garnitures").select("id")
    .eq("user_id", auth.userId).eq("id", params.id).maybeSingle();
  if (readError) return NextResponse.json({ error: "Загварыг шалгаж чадсангүй." }, { status: 503, headers });
  if (!kitchen) return NextResponse.json({ error: "Загвар олдсонгүй." }, { status: 404, headers });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !IMAGE_TYPES.has(file.type) || file.size < 100 || file.size > 5_000_000) {
      return NextResponse.json({ error: "JPG, PNG эсвэл WEBP зураг (5MB хүртэл) сонгоно уу." }, { status: 400, headers });
    }
    const image = await uploadCloudinaryImage(file, `casa-nova/kitchen-projects/${params.id}`, { overwrite: true });
    const { error } = await db.from("kitchen_garnitures").update({ thumbnail_url: image.url })
      .eq("user_id", auth.userId).eq("id", params.id);
    if (error) return NextResponse.json({ error: "3D зургийг төсөлтэй холбож чадсангүй." }, { status: 503, headers });
    return NextResponse.json({ thumbnailUrl: image.url, width: image.width, height: image.height }, { headers });
  } catch {
    return NextResponse.json({ error: "3D зургийг хадгалж чадсангүй." }, { status: 503, headers });
  }
}
