import { apiErrorResponse } from "@/lib/api/errors";
import { NextRequest } from "next/server";
import { kitchenGlbModelPath, kitchenGlbModelResponse } from "@/lib/kitchenDesignModels";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { authorize } from "@/lib/supabase/authorize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * GLB of one design version. The live published version is public; any other
 * version is visible only to its merchant or an admin (Bearer token).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; file: string }> }) {
  const { id, file } = await params;
  const versionId = file.replace(/\.glb$/i, "");
  const headers = { "Cache-Control": "no-store" };
  if (!UUID.test(id) || !UUID.test(versionId) || !file.endsWith(".glb"))
    return apiErrorResponse({ error: "Файлын зам буруу байна." }, { status: 400, headers });
  try {
    const db = getSupabaseAdmin();
    const [{ data: design, error }, { data: version, error: versionError }] = await Promise.all([
      db.from("kitchen_designs").select("id,created_by,publication_status,published_version_id").eq("id", id).maybeSingle(),
      db.from("kitchen_design_versions").select("id,model:design->model").eq("id", versionId).eq("design_id", id).maybeSingle(),
    ]);
    if (error) throw error;
    if (versionError) throw versionError;
    const key = kitchenGlbModelPath(version?.model);
    if (!design || !key) return apiErrorResponse({ error: "Файл олдсонгүй." }, { status: 404, headers });
    const isPublic = design.publication_status === "published" && design.published_version_id === versionId;
    if (!isPublic) {
      const auth = await authorize(request);
      if (auth.error) return apiErrorResponse({ error: "Файл олдсонгүй." }, { status: 404, headers });
      if (auth.userId !== design.created_by) {
        const { data: profile } = await db.from("profiles").select("role").eq("id", auth.userId).maybeSingle();
        if (profile?.role !== "admin") return apiErrorResponse({ error: "Файл олдсонгүй." }, { status: 404, headers });
      }
    }
    // Every upload has its own key, so a version's file never changes.
    return await kitchenGlbModelResponse(
      key,
      isPublic ? "public, max-age=3600, s-maxage=86400, stale-while-revalidate=600" : "private, max-age=3600",
    );
  } catch (error) {
    console.error("[kitchen design model]", id, versionId, error);
    return apiErrorResponse({ error: "Файлыг ачаалж чадсангүй." }, { status: 503, headers });
  }
}
