import "server-only";

export const CLOUDFLARE_RENDER_MODEL = "@cf/black-forest-labs/flux-2-klein-4b";
const OPENAI_MODELS = new Set([
  "gpt-image-2.5-sunburst",
  "gpt-image-2.5-flare",
]);
export type KitchenRenderConfig = {
  provider: "cloudflare" | "openai";
  model: string;
};

export function configuredKitchenRender(): KitchenRenderConfig {
  const provider = process.env.KITCHEN_RENDER_PROVIDER ?? "openai";
  if (provider === "cloudflare")
    return { provider, model: CLOUDFLARE_RENDER_MODEL };
  if (provider !== "openai") throw new Error("INVALID_RENDER_PROVIDER");
  const configured = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2.5-sunburst";
  return {
    provider,
    model: OPENAI_MODELS.has(configured)
      ? configured
      : "gpt-image-2.5-sunburst",
  };
}

export function validKitchenRender(config: {
  provider: string;
  model: string;
}) {
  return config.provider === "cloudflare"
    ? config.model === CLOUDFLARE_RENDER_MODEL
    : config.provider === "openai" && OPENAI_MODELS.has(config.model);
}

export function cloudflareRenderEndpoint() {
  try {
    const url = new URL(process.env.CLOUDFLARE_RENDER_URL ?? "");
    if (
      url.protocol !== "https:" ||
      !url.hostname.endsWith(".workers.dev") ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return null;
    return url;
  } catch {
    return null;
  }
}

export function kitchenRenderConfigured(config: {
  provider: string;
  model: string;
}) {
  if (!validKitchenRender(config)) return false;
  return config.provider === "cloudflare"
    ? Boolean(
        cloudflareRenderEndpoint() &&
        process.env.CLOUDFLARE_RENDER_TOKEN &&
        process.env.CLOUDFLARE_RENDER_FREE_CONFIRMED === "true",
      )
    : Boolean(process.env.OPENAI_API_KEY);
}
