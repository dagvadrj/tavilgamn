import { NextRequest } from "next/server";
import { templateId } from "@/lib/roomTemplates";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { apiErrorResponse } from "@/lib/api/errors";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!templateId(id))
    return apiErrorResponse(
      { error: "Зургийн дугаар буруу байна." },
      { status: 400 },
    );
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("room_templates")
      .select("preview_image")
      .eq("id", id)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw error;
    const match = data?.preview_image.match(
      /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/,
    );
    if (!match)
      return apiErrorResponse({ error: "Зураг олдсонгүй." }, { status: 404 });
    return new Response(Buffer.from(match[2], "base64"), {
      headers: {
        "Content-Type": match[1],
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return apiErrorResponse(
      { error: "Зураг ачаалж чадсангүй." },
      { status: 503 },
    );
  }
}
