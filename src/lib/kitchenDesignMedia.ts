import type { KitchenDesignSummary } from "./kitchenMarketplace";

export type KitchenDesignMedia = KitchenDesignSummary["media"][number];

export function isKitchenAiMedia(item: KitchenDesignMedia) {
  return item.kind === "ai_render" || item.source === "ai";
}

// The planner thumbnail remains the render input. Presentation prefers the latest
// ready AI output belonging to the version already selected by the server.
export function kitchenGalleryMedia(media: readonly KitchenDesignMedia[]) {
  return [...media].sort((a, b) => {
    const aiA = isKitchenAiMedia(a);
    const aiB = isKitchenAiMedia(b);
    if (aiA !== aiB) return aiA ? -1 : 1;
    if (aiA && aiB) {
      const newest =
        (Date.parse(b.createdAt || "") || 0) -
        (Date.parse(a.createdAt || "") || 0);
      if (newest) return newest;
    }
    return Number(b.isPrimary) - Number(a.isPrimary);
  });
}

export function kitchenMediaLabel(item: KitchenDesignMedia) {
  if (isKitchenAiMedia(item)) return "AI бодит дүрслэл";
  if (item.kind === "photo") return "Бодит зураг";
  if (item.kind === "plan") return "Өрөөний төлөвлөлт";
  if (item.kind === "thumbnail")
    return item.source === "merchant" ? "Үндсэн зураг" : "3D загвар";
  return "Render зураг";
}

export function kitchenRenderSources(media: readonly KitchenDesignMedia[]) {
  return kitchenGalleryMedia(media).filter((item) =>
    ["thumbnail", "render", "photo", "plan"].includes(item.kind),
  );
}

export function kitchenRenderSource(
  media: readonly KitchenDesignMedia[],
  selectedId?: string | null,
) {
  const sources = kitchenRenderSources(media);
  return (
    sources.find((item) => item.id === selectedId) ??
    sources.find((item) => item.kind === "thumbnail" && item.isPrimary) ??
    sources.find((item) => item.source === "system") ??
    sources[0] ??
    null
  );
}
