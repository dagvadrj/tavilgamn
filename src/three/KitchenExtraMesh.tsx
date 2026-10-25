"use client";
import type { KitchenExtra } from "@/lib/kitchenExtras";
import { GLBFurnitureMesh } from "./GLBFurnitureMesh";
import { pcmallAppliance, PCMALL_MODEL_BASE_PATH } from "@/lib/pcmallAppliances";
export function KitchenExtraMesh({ extra, selected = false }: { extra: KitchenExtra; selected?: boolean }) {
  const dimensions={w:extra.width/1000,h:extra.height/1000,d:extra.depth/1000};
  const imported = extra.model ? pcmallAppliance(extra.productId, extra.model) : undefined;
  return extra.model ? <GLBFurnitureMesh modelId={extra.model.id} basePath={imported ? PCMALL_MODEL_BASE_PATH : `/api/models/files/${extra.model.id}`} glbFile={extra.model.file}
    selected={selected} preservePhysicalSize={Boolean(imported)} strictDimensions={Boolean(imported)} showLoadStatus={selected} {...dimensions} />
    : null;
}
