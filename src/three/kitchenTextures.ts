"use client";

import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from "three";
import type { Finish } from "@/lib/kitchen";

/** Neutral procedural patterns; the material color supplies the chosen tint. No remote assets. */
export function createKitchenTexture(finish: Finish): DataTexture | null {
  if (finish === "matte" || finish === "gloss") return null;
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size * Math.PI * 2;
      const v = y / size * Math.PI * 2;
      const grain = Math.sin(u * 10 + 1.6 * Math.sin(v) + 0.4 * Math.sin(v * 3));
      const noise = Math.sin(u * 37 + v * 29) * Math.sin(u * 19 - v * 43);
      let value: number;
      if (finish === "oak" || finish === "walnut") {
        value = 239 + grain * 6 + noise * 2 + Math.sin(u * 5 + Math.sin(v)) * 4;
      } else if (finish === "marble") {
        const vein = Math.pow(Math.abs(Math.sin(u * 2 + Math.sin(v + Math.sin(u)) * 2)), 24);
        value = 250 - vein * 26 + noise * 2;
      } else {
        value = 231 + noise * 15 + Math.sin(u * 3) * Math.sin(v * 4) * 8;
      }
      const offset = (y * size + x) * 4;
      data[offset] = data[offset + 1] = data[offset + 2] = Math.max(0, Math.min(255, Math.round(value)));
      data[offset + 3] = 255;
    }
  }
  const texture = new DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
