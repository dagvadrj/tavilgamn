import "server-only";
import { cloudflareRenderEndpoint } from "./kitchenRenderConfig";
import { limitedResponseBytes } from "./cloudflareKitchenRender";

export const KITCHEN_TEXT_MODEL = "@cf/google/gemma-4-26b-a4b-it";
export const KITCHEN_TEXT_FIELDS = [
  "title",
  "shortDescription",
  "description",
] as const;
export type KitchenTextField = (typeof KITCHEN_TEXT_FIELDS)[number];
export function kitchenTextConfigured() {
  return Boolean(
    cloudflareRenderEndpoint() &&
    process.env.CLOUDFLARE_RENDER_TOKEN &&
    process.env.CLOUDFLARE_RENDER_FREE_CONFIRMED === "true",
  );
}
export async function generateKitchenListingText(
  actor: string,
  field: KitchenTextField,
  facts: Record<string, unknown>,
) {
  if (!kitchenTextConfigured()) throw new Error("TEXT_NOT_CONFIGURED");
  const endpoint = cloudflareRenderEndpoint()!;
  endpoint.pathname = "/text";
  const response = await fetch(endpoint, {
    method: "POST",
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
    headers: {
      Authorization: `Bearer ${process.env.CLOUDFLARE_RENDER_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ actor, field, facts }),
  });
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? "TEXT_QUOTA_EXCEEDED"
        : "TEXT_GENERATION_FAILED",
    );
  const result = JSON.parse(
    new TextDecoder().decode(await limitedResponseBytes(response, 32_000)),
  );
  const max =
    field === "title" ? 160 : field === "shortDescription" ? 300 : 1800;
  if (
    typeof result.text !== "string" ||
    !result.text.trim() ||
    result.text.length > max ||
    result.model !== KITCHEN_TEXT_MODEL
  )
    throw new Error("INVALID_TEXT_RESULT");
  return { text: result.text.trim(), model: KITCHEN_TEXT_MODEL };
}
