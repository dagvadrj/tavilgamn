import "server-only";
import { Buffer } from "node:buffer";
import { uploadCloudinaryImage } from "./cloudinaryImageUpload";
import { getSupabaseAdmin } from "./supabase/admin";
import {
  kitchenRenderConfigured,
  validKitchenRender,
  type KitchenRenderConfig,
} from "./kitchenRenderConfig";
import {
  generateCloudflareKitchenRender,
  limitedResponseBytes,
} from "./cloudflareKitchenRender";
type ClaimedJob = {
  id: string;
  versionId: string;
  inputImageUrl: string;
  prompt: string;
  provider: string;
  model: string;
};

function trustedSource(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "res.cloudinary.com"
      ? url
      : null;
  } catch {
    return null;
  }
}

export async function generateKitchenRender(
  actor: string,
  jobId: string,
  override?: KitchenRenderConfig | null,
) {
  let claimed = false;
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db.rpc("claim_kitchen_render", {
      p_actor: actor,
      p_job: jobId,
    });
    if (error) throw error;
    const job = data as ClaimedJob;
    claimed = true;
    const sourceUrl = trustedSource(job.inputImageUrl);
    if (!sourceUrl || !validKitchenRender(job))
      throw new Error("INVALID_RENDER_JOB");
    const target = override ?? { provider: job.provider, model: job.model };
    if (!kitchenRenderConfigured(target))
      throw new Error("RENDER_NOT_CONFIGURED");
    if (target.provider !== job.provider || target.model !== job.model) {
      // The job is exclusively claimed; record the provider used for this output.
      const { error: providerError } = await db
        .from("kitchen_render_jobs")
        .update({ provider: target.provider, model: target.model })
        .eq("id", jobId)
        .eq("status", "processing");
      if (providerError) throw providerError;
    }

    const sourceResponse = await fetch(sourceUrl, {
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    const contentType =
      sourceResponse.headers.get("content-type")?.split(";")[0] ?? "";
    if (
      !sourceResponse.ok ||
      !["image/jpeg", "image/png", "image/webp"].includes(contentType)
    )
      throw new Error("SOURCE_IMAGE_FAILED");
    const sourceBytes = await limitedResponseBytes(
      sourceResponse,
      20 * 1024 * 1024,
    );
    const source = new Blob([new Uint8Array(sourceBytes)], {
      type: contentType,
    });
    if (!source.size || source.size > 20 * 1024 * 1024)
      throw new Error("SOURCE_IMAGE_FAILED");

    let output: Blob;
    let requestId: string | null;
    let usage = null;
    if (target.provider === "cloudflare") {
      const generated = await generateCloudflareKitchenRender(
        source,
        job.prompt,
        jobId,
      );
      output = generated.image;
      requestId = generated.requestId;
    } else {
      const form = new FormData();
      form.set("model", target.model);
      form.set(
        "image[]",
        source,
        `kitchen-reference.${contentType.split("/")[1]}`,
      );
      form.set("prompt", job.prompt);
      form.set("size", "1536x1024");
      form.set("quality", "medium");
      form.set("output_format", "webp");
      form.set("output_compression", "85");
      form.set("moderation", "auto");
      const generation = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: form,
        signal: AbortSignal.timeout(180_000),
      });
      requestId = generation.headers.get("x-request-id");
      const result = await generation.json().catch(() => null);
      const encoded = result?.data?.[0]?.b64_json;
      if (
        !generation.ok ||
        typeof encoded !== "string" ||
        encoded.length > 40_000_000
      ) {
        throw new Error(
          `OPENAI_IMAGE_FAILED:${generation.status}:${String(result?.error?.code ?? "unknown")}`,
        );
      }
      const bytes = Buffer.from(encoded, "base64");
      if (!bytes.length || bytes.length > 25 * 1024 * 1024)
        throw new Error("OPENAI_IMAGE_INVALID");
      output = new Blob([new Uint8Array(bytes)], { type: "image/webp" });
      usage = result?.usage ?? null;
    }
    const image = await uploadCloudinaryImage(
      output,
      `casa-nova/kitchen-renders/${jobId}`,
    );
    const metadata = {
      provider: target.provider,
      model: target.model,
      providerRequestId: requestId,
      requestedProvider: job.provider,
      requestedModel: job.model,
      usage,
      size: target.provider === "cloudflare" ? "1024x768" : "1536x1024",
      quality: target.provider === "cloudflare" ? "4-step" : "medium",
      outputFormat: "webp",
      cloudinaryPublicId: image.publicId,
      format: image.format,
      bytes: image.bytes,
    };
    const { data: mediaId, error: completeError } = await db.rpc(
      "complete_kitchen_render",
      {
        p_actor: actor,
        p_job: jobId,
        p_url: image.url,
        p_alt: "AI бодит дүрслэл",
        p_width: image.width,
        p_height: image.height,
        p_metadata: metadata,
      },
    );
    if (completeError) throw completeError;
    return { id: jobId, status: "completed" as const, mediaId, url: image.url };
  } catch (error) {
    if (claimed) {
      try {
        const result = await getSupabaseAdmin().rpc("fail_kitchen_render", {
          p_actor: actor,
          p_job: jobId,
          p_error:
            error instanceof Error
              ? error.message.slice(0, 5000)
              : "Generation failed",
          p_metadata: { failedAt: new Date().toISOString() },
        });
        if (result.error)
          console.error("Kitchen render failure state could not be saved", {
            jobId,
            code: result.error.code,
          });
      } catch {
        /* Preserve the generation failure. */
      }
    }
    throw error;
  }
}
