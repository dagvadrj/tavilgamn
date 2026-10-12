import "server-only";
import { Buffer } from "node:buffer";
import sharp from "sharp";
import { cloudflareRenderEndpoint } from "./kitchenRenderConfig";

export async function limitedResponseBytes(response: Response, limit: number) {
  if (!response.body) throw new Error("IMAGE_RESPONSE_EMPTY");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error("IMAGE_RESPONSE_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

export async function generateCloudflareKitchenRender(
  source: Blob,
  prompt: string,
  jobId: string,
) {
  const endpoint = cloudflareRenderEndpoint();
  if (
    !endpoint ||
    !process.env.CLOUDFLARE_RENDER_TOKEN ||
    process.env.CLOUDFLARE_RENDER_FREE_CONFIRMED !== "true"
  )
    throw new Error("CLOUDFLARE_RENDER_NOT_CONFIGURED");
  // FLUX.2 klein requires references smaller than 512 × 512 pixels.
  const reference = await sharp(Buffer.from(await source.arrayBuffer()), {
    limitInputPixels: 40_000_000,
  })
    .rotate()
    .resize({
      width: 510,
      height: 510,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 90 })
    .toBuffer();
  const form = new FormData();
  form.set(
    "input_image_0",
    new Blob([new Uint8Array(reference)], { type: "image/jpeg" }),
    "reference.jpg",
  );
  form.set("prompt", prompt);
  form.set("jobId", jobId);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_RENDER_TOKEN}` },
    body: form,
    redirect: "error",
    signal: AbortSignal.timeout(180_000),
  });
  const raw = await limitedResponseBytes(response, 36_000_000);
  const result = JSON.parse(raw.toString("utf8"));
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? "CLOUDFLARE_RENDER_QUOTA"
        : "CLOUDFLARE_RENDER_FAILED",
    );
  if (
    typeof result.image !== "string" ||
    result.image.length > 34_000_000 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(result.image)
  )
    throw new Error("CLOUDFLARE_IMAGE_INVALID");
  const bytes = Buffer.from(result.image, "base64");
  if (!bytes.length || bytes.length > 25 * 1024 * 1024)
    throw new Error("CLOUDFLARE_IMAGE_INVALID");
  const output = await sharp(bytes, { limitInputPixels: 4_000_000 })
    .webp({ quality: 85 })
    .toBuffer();
  return {
    image: new Blob([new Uint8Array(output)], { type: "image/webp" }),
    requestId: response.headers.get("x-render-request-id"),
  };
}
