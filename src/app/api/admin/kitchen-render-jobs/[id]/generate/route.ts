import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import { cloudinaryImageUploadConfigured, uploadCloudinaryImage } from "@/lib/cloudinaryImageUpload";
import { kitchenMarketplaceError, kitchenPrivateHeaders } from "@/lib/kitchenMarketplaceHttp";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IMAGE_MODELS = new Set(["gpt-image-2.5-sunburst", "gpt-image-2.5-flare"]);
type ClaimedJob = { id: string; versionId: string; inputImageUrl: string; prompt: string; provider: string; model: string };

function trustedSource(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" && url.hostname === "res.cloudinary.com" ? url : null; }
  catch { return null; }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  let actor = "";
  let claimed = false;
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    actor = auth.userId;
    if (!UUID.test(params.id)) return NextResponse.json({ error: "Render job ID буруу байна." }, { status: 400, headers: kitchenPrivateHeaders });
    if (!process.env.OPENAI_API_KEY || !cloudinaryImageUploadConfigured()) {
      return NextResponse.json({ error: "OPENAI_API_KEY эсвэл Cloudinary тохиргоо дутуу байна." }, { status: 503, headers: kitchenPrivateHeaders });
    }
    const db = getSupabaseAdmin();
    const { data, error } = await db.rpc("claim_kitchen_render", { p_actor: actor, p_job: params.id });
    if (error) throw error;
    const job = data as ClaimedJob;
    claimed = true;
    const sourceUrl = trustedSource(job.inputImageUrl);
    if (!sourceUrl || job.provider !== "openai" || !IMAGE_MODELS.has(job.model)) throw new Error("INVALID_RENDER_JOB");

    const sourceResponse = await fetch(sourceUrl, { signal: AbortSignal.timeout(30_000) });
    const contentType = sourceResponse.headers.get("content-type")?.split(";")[0] ?? "";
    if (!sourceResponse.ok || !["image/jpeg", "image/png", "image/webp"].includes(contentType)) throw new Error("SOURCE_IMAGE_FAILED");
    const source = await sourceResponse.blob();
    if (!source.size || source.size > 20 * 1024 * 1024) throw new Error("SOURCE_IMAGE_FAILED");

    const form = new FormData();
    form.set("model", job.model);
    form.set("image[]", source, `kitchen-reference.${contentType.split("/")[1]}`);
    form.set("prompt", job.prompt);
    form.set("size", "1536x1024");
    form.set("quality", "medium");
    form.set("output_format", "webp");
    form.set("output_compression", "85");
    form.set("moderation", "auto");
    const generation = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: form,
      signal: AbortSignal.timeout(180_000),
    });
    const requestId = generation.headers.get("x-request-id");
    const result = await generation.json().catch(() => null);
    const encoded = result?.data?.[0]?.b64_json;
    if (!generation.ok || typeof encoded !== "string" || encoded.length > 40_000_000) {
      throw new Error(`OPENAI_IMAGE_FAILED:${generation.status}:${String(result?.error?.code ?? "unknown")}`);
    }
    const bytes = Buffer.from(encoded, "base64");
    if (!bytes.length || bytes.length > 25 * 1024 * 1024) throw new Error("OPENAI_IMAGE_INVALID");
    const image = await uploadCloudinaryImage(new Blob([new Uint8Array(bytes)], { type: "image/webp" }), `casa-nova/kitchen-renders/${params.id}`);
    const metadata = { provider: "openai", model: job.model, providerRequestId: requestId,
      usage: result?.usage ?? null, size: "1536x1024", quality: "medium", outputFormat: "webp",
      cloudinaryPublicId: image.publicId, format: image.format, bytes: image.bytes };
    const { data: mediaId, error: completeError } = await db.rpc("complete_kitchen_render", {
      p_actor: actor, p_job: params.id, p_url: image.url, p_alt: "AI бодит дүрслэл",
      p_width: image.width, p_height: image.height, p_metadata: metadata,
    });
    if (completeError) throw completeError;
    return NextResponse.json({ id: params.id, status: "completed", mediaId, url: image.url }, { headers: kitchenPrivateHeaders });
  } catch (error) {
    if (claimed && actor) {
      const message = error instanceof Error ? error.message.slice(0, 5000) : "Generation failed";
      try {
        await getSupabaseAdmin().rpc("fail_kitchen_render", {
          p_actor: actor, p_job: params.id, p_error: message, p_metadata: { failedAt: new Date().toISOString() },
        });
      } catch { /* Preserve the original generation error. */ }
    }
    return kitchenMarketplaceError(error, "AI render үүсгэж чадсангүй.");
  }
}
