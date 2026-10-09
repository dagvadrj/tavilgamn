"use client";
import type { KitchenExtra } from "@/lib/kitchenExtras";
import { GLBFurnitureMesh } from "./GLBFurnitureMesh";
export function KitchenExtraMesh({ extra, selected = false }: { extra: KitchenExtra; selected?: boolean }) {
  const dimensions={w:extra.width/1000,h:extra.height/1000,d:extra.depth/1000};
  return extra.model ? <GLBFurnitureMesh modelId={extra.model.id} basePath={`/api/models/files/${extra.model.id}`} glbFile={extra.model.file}
    previewGlbFile={extra.model.previewFile} selected={selected} {...dimensions} />
    : null;
}
