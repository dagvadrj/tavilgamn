"use client";

import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from "three";
import type { Finish } from "@/lib/kitchen";

const fract = (value: number) => value - Math.floor(value);
const hash = (x: number, y: number) => {
  let value = Math.imul(x + 374761393, 668265263) ^ Math.imul(y + 1274126177, 2246822519);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
};
function stoneNoise(x: number, y: number, cells: number) {
  const px = fract(x) * cells, py = fract(y) * cells;
  const ix = Math.floor(px), iy = Math.floor(py);
  const fx = fract(px), fy = fract(py);
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash((ix + 1) % cells, iy);
  const c = hash(ix, (iy + 1) % cells), d = hash((ix + 1) % cells, (iy + 1) % cells);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

/** Neutral procedural patterns; the material color supplies the chosen tint. No remote assets. */
export function createKitchenTexture(finish: Finish): DataTexture | null {
  if (finish === "matte" || finish === "gloss") return null;
  const size = finish === "marble" || finish === "concrete" ? 512 : 256;
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
        const coarse = stoneNoise(x / size, y / size, 4);
        const cloud = stoneNoise(x / size, y / size, 12);
        const mineral = stoneNoise(x / size, y / size, 48);
        const vein = Math.exp(-Math.abs(Math.sin(u + v * 2 + (coarse - 0.5) * 4)) * 55);
        value = 247 + (cloud - 0.5) * 6 + (mineral - 0.5) * 3 - vein * 15;
      } else {
        value = 237 + (stoneNoise(x / size, y / size, 6) - 0.5) * 10
          + (stoneNoise(x / size, y / size, 40) - 0.5) * 6 + (hash(x, y) - 0.5) * 4;
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
