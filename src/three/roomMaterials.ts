"use client";

import { useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
  Vector2,
  type MeshStandardMaterial,
  type MeshStandardMaterialParameters,
} from "three";
import { getRoomMaterial, type RoomMaterialDefinition } from "@/lib/roomMaterials";

interface MaterialPixels {
  size: number;
  albedo: Uint8Array<ArrayBuffer>;
  normal: Uint8Array<ArrayBuffer>;
  roughness: Uint8Array<ArrayBuffer>;
}

interface RoomTextureSet {
  materialId: string;
  map: DataTexture;
  normalMap: DataTexture;
  roughnessMap: DataTexture;
  normalScale: Vector2;
}

// Only immutable CPU pixels are shared. Each surface owns its texture transforms
// and GPU lifetime, so walls of different lengths cannot change each other's UVs.
const pixelCache = new Map<string, MaterialPixels>();
const MAX_CACHED_MATERIALS = 8;
// Adding/removing a map changes Three's shader defines. R3F updates properties
// but does not invalidate a material's program automatically on map changes.
const refreshMaterialProgram = (material: MeshStandardMaterial) => { material.needsUpdate = true; };
const TAU = Math.PI * 2;
const fract = (value: number) => value - Math.floor(value);
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const smooth = (value: number) => value * value * (3 - 2 * value);

function hash(x: number, y: number, seed = 0): number {
  let value = Math.imul(x + 374761393, 668265263) ^ Math.imul(y + 1274126177, 2246822519) ^ seed;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

/** Periodic value noise keeps every texture edge seamless under RepeatWrapping. */
function noise(u: number, v: number, cellsX: number, cellsY: number, seed = 0): number {
  const x = fract(u) * cellsX;
  const y = fract(v) * cellsY;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(fract(x));
  const fy = smooth(fract(y));
  const a = hash(ix, iy, seed);
  const b = hash((ix + 1) % cellsX, iy, seed);
  const c = hash(ix, (iy + 1) % cellsY, seed);
  const d = hash((ix + 1) % cellsX, (iy + 1) % cellsY, seed);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}

function rgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [value >>> 16, (value >>> 8) & 255, value & 255];
}

function generatePixels(definition: RoomMaterialDefinition): MaterialPixels {
  const cached = pixelCache.get(definition.id);
  if (cached) return cached;
  const isWood = definition.pattern === "wood" || definition.pattern === "laminate";
  const isTile = ["stone", "ceramic", "terrazzo"].includes(definition.pattern);
  const size = isWood || isTile ? 512 : 256;
  const total = size * size;
  const albedo = new Uint8Array(total * 4);
  const normal = new Uint8Array(total * 4);
  const roughness = new Uint8Array(total * 4);
  const heights = new Float32Array(total);
  const base = rgb(definition.color);
  const accent = rgb(definition.accent);
  const seed = [...definition.id].reduce((value, character) => Math.imul(value, 31) + character.charCodeAt(0), 0);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const grainNoise = hash(x, y, seed) - 0.5;
      let shade = 0;
      let mix = 0;
      let height = 0.5;
      let rough = definition.roughness;

      if (isWood) {
        const row = Math.floor(v * 6);
        const across = fract(v * 6);
        const along = fract(u * 2 + (row % 2) * 0.5);
        const plank = Math.floor(u * 2 + (row % 2) * 0.5) % 2;
        const tint = hash(plank, row, seed);
        const warp = Math.sin(u * TAU * 2 + tint * TAU) * 0.065 + noise(u, v, 4, 12, seed) * 0.05;
        const grain = Math.sin((across + warp) * TAU * 13 + Math.sin(u * TAU * 4) * 1.5);
        const fineGrain = Math.sin((across + warp * 0.5) * TAU * 56);
        const coarse = noise(u, v, 8, 64, seed) - 0.5;
        // Staggered end joints and bevelled long edges are present in all maps.
        const distance = Math.min(across, 1 - across, along * 2, (1 - along) * 2);
        const seam = 1 - smooth(clamp(distance / 0.022));
        const pores = Math.pow(clamp(-grain), 5) * 0.055;
        const knotX = (along - 0.45) / 0.15;
        const knotY = (across - 0.48) / 0.36;
        const knotDistance = Math.sqrt(knotX * knotX + knotY * knotY);
        const knot = tint > 0.72 ? Math.exp(-knotDistance * 3) * (0.5 + 0.5 * Math.sin(knotDistance * 32)) : 0;
        shade = (tint - 0.5) * 0.2 + coarse * 0.08 + grain * 0.028 + fineGrain * 0.008 + grainNoise * 0.018;
        mix = pores + seam * 0.57 + knot * 0.35;
        height = 0.6 - seam * 0.45 - pores + grain * 0.012 + fineGrain * 0.006 - knot * 0.025;
        rough += coarse * 0.08 + pores + seam * 0.27;
      } else if (isTile) {
        const tileX = Math.floor(u * 2);
        const tileY = Math.floor(v * 2);
        const edge = Math.min(fract(u * 2), 1 - fract(u * 2), fract(v * 2), 1 - fract(v * 2));
        const grout = 1 - smooth(clamp(edge / 0.014));
        const cloud = noise(u, v, 8, 8, seed) - 0.5;
        const detail = noise(u, v, 64, 64, seed) - 0.5;
        shade = (hash(tileX, tileY, seed) - 0.5) * 0.035 + grainNoise * 0.006;
        if (definition.pattern === "stone") {
          const vein = Math.pow(Math.abs(Math.sin((u + v) * TAU * 3 + cloud * 4)), 18);
          shade += cloud * 0.12 + detail * 0.035;
          mix = vein * 0.11;
          height += detail * 0.07;
          rough += detail * 0.1;
        } else if (definition.pattern === "terrazzo") {
          const cellX = Math.floor(u * 40);
          const cellY = Math.floor(v * 40);
          const chipSeed = hash(cellX, cellY, seed);
          const chipX = fract(u * 40) - 0.5;
          const chipY = fract(v * 40) - 0.5;
          const chip = chipX * chipX / 0.13 + chipY * chipY / (0.04 + chipSeed * 0.17) < 1;
          if (chip && chipSeed > 0.28) {
            mix = chipSeed > 0.68 ? 0.58 : 0.26;
            shade += chipSeed < 0.52 ? 0.15 : -0.02;
            rough -= 0.08;
          }
          shade += detail * 0.025;
        }
        mix = mix * (1 - grout) + grout * 0.65;
        height = height * (1 - grout) + 0.1 * grout;
        rough = rough * (1 - grout) + 0.93 * grout;
      } else if (definition.pattern === "carpet" || definition.pattern === "linen") {
        const isCarpet = definition.pattern === "carpet";
        const threadX = Math.sin(u * TAU * (isCarpet ? 96 : 80));
        const threadY = Math.sin(v * TAU * (isCarpet ? 96 : 80));
        const weave = threadX * threadY;
        const cloud = noise(u, v, 16, 16, seed) - 0.5;
        shade = cloud * 0.075 + grainNoise * (isCarpet ? 0.15 : 0.075) + weave * 0.018;
        mix = Math.max(0, -weave) * 0.065;
        height = 0.5 + weave * 0.05 + grainNoise * (isCarpet ? 0.2 : 0.06);
        rough += grainNoise * 0.025;
      } else if (definition.pattern === "stripes") {
        mix = fract(u * 4) < 0.48 ? 0 : 0.83;
        shade = grainNoise * 0.017;
        height += grainNoise * 0.025;
      } else if (definition.pattern === "geometric") {
        const diagonalA = Math.abs(fract((u + v) * 2) - 0.5);
        const diagonalB = Math.abs(fract((u - v) * 2) - 0.5);
        mix = Math.min(diagonalA, diagonalB) < 0.012 ? 0.8 : 0;
        shade = grainNoise * 0.018;
        height += mix * 0.025 + grainNoise * 0.018;
      } else if (definition.pattern === "botanical") {
        // Repeating stems with alternating almond leaves, kept inside their cells.
        const cellU = fract(u * 2 + Math.floor(v * 2) * 0.5);
        const cellV = fract(v * 2);
        const stemX = 0.5 + Math.sin(cellV * TAU) * 0.08;
        let leaf = 0;
        for (let index = 0; index < 4; index++) {
          const side = index % 2 === 0 ? -1 : 1;
          const centerY = 0.19 + index * 0.2;
          const centerX = 0.5 + Math.sin(centerY * TAU) * 0.08 + side * 0.115;
          const dx = cellU - centerX;
          const dy = cellV - centerY;
          const rotatedX = dx * 0.8 + dy * side * 0.6;
          const rotatedY = -dx * side * 0.6 + dy * 0.8;
          if ((rotatedX / 0.17) ** 2 + (rotatedY / 0.065) ** 2 < 1) leaf = 0.72 + index * 0.045;
        }
        const stem = cellV > 0.04 && cellV < 0.94 && Math.abs(cellU - stemX) < 0.005;
        mix = stem ? 0.85 : leaf;
        shade = grainNoise * 0.016;
        height += mix * 0.015 + grainNoise * 0.018;
      } else {
        const plaster = definition.pattern === "plaster";
        const cloud = noise(u, v, 12, 12, seed) - 0.5;
        const fine = noise(u, v, 64, 64, seed) - 0.5;
        shade = (cloud * 0.065 + fine * 0.04 + grainNoise * 0.028) * (plaster ? 1 : 0.15);
        height += (cloud * 0.18 + fine * 0.15 + grainNoise * 0.06) * (plaster ? 1 : 0.1);
      }

      const pixel = y * size + x;
      const offset = pixel * 4;
      heights[pixel] = height;
      for (let channel = 0; channel < 3; channel++) {
        albedo[offset + channel] = Math.round(clamp((base[channel] * (1 - mix) + accent[channel] * mix) * (1 + shade), 0, 255));
        roughness[offset + channel] = Math.round(clamp(rough) * 255);
      }
      albedo[offset + 3] = 255;
      roughness[offset + 3] = 255;
    }
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Wrapped central differences include grout/bevel normals at tile borders.
      const left = heights[y * size + (x + size - 1) % size];
      const right = heights[y * size + (x + 1) % size];
      const down = heights[((y + size - 1) % size) * size + x];
      const up = heights[((y + 1) % size) * size + x];
      const nx = (left - right) * 2.5;
      const ny = (down - up) * 2.5;
      const length = Math.sqrt(nx * nx + ny * ny + 1);
      const offset = (y * size + x) * 4;
      normal[offset] = Math.round((nx / length * 0.5 + 0.5) * 255);
      normal[offset + 1] = Math.round((ny / length * 0.5 + 0.5) * 255);
      normal[offset + 2] = Math.round((1 / length * 0.5 + 0.5) * 255);
      normal[offset + 3] = 255;
    }
  }

  const pixels = { size, albedo, normal, roughness };
  if (pixelCache.size >= MAX_CACHED_MATERIALS) {
    const oldest = pixelCache.keys().next().value as string | undefined;
    if (oldest) pixelCache.delete(oldest);
  }
  pixelCache.set(definition.id, pixels);
  return pixels;
}

function makeTexture(data: Uint8Array<ArrayBuffer>, size: number, isColor: boolean, anisotropy: number): DataTexture {
  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.colorSpace = isColor ? SRGBColorSpace : NoColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

/**
 * MeshStandardMaterial props for UVs normalized to 0..1 across the whole surface.
 * width/height are metres. An absent/unknown id preserves legacy solid colours.
 */
export function useRoomMaterial(
  materialId: string | undefined,
  width: number,
  height: number,
  color = "#e5e0d4",
): Pick<MeshStandardMaterialParameters, "map" | "normalMap" | "roughnessMap" | "color" | "roughness" | "metalness" | "normalScale"> & { onUpdate: (material: MeshStandardMaterial) => void } {
  const definition = getRoomMaterial(materialId);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const [textures, setTextures] = useState<RoomTextureSet | null>(null);

  useEffect(() => {
    if (!definition) {
      setTextures(null);
      return;
    }
    const pixels = generatePixels(definition);
    const anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    const next: RoomTextureSet = {
      materialId: definition.id,
      map: makeTexture(pixels.albedo, pixels.size, true, anisotropy),
      normalMap: makeTexture(pixels.normal, pixels.size, false, anisotropy),
      roughnessMap: makeTexture(pixels.roughness, pixels.size, false, anisotropy),
      normalScale: new Vector2(definition.normalStrength, definition.normalStrength),
    };
    setTextures(next);
    // Allocate after commit so abandoned renders never retain GPU resources.
    // StrictMode's second setup receives a new set after the first is disposed.
    return () => {
      next.map.dispose();
      next.normalMap.dispose();
      next.roughnessMap.dispose();
    };
  }, [definition, gl]);

  useEffect(() => {
    if (!textures || !definition || textures.materialId !== definition.id) return;
    const repeatX = Math.max(0.01, Number.isFinite(width) ? width : 1) / definition.tileMetersX;
    const repeatY = Math.max(0.01, Number.isFinite(height) ? height : 1) / definition.tileMetersY;
    for (const texture of [textures.map, textures.normalMap, textures.roughnessMap]) {
      texture.repeat.set(repeatX, repeatY);
      texture.updateMatrix();
    }
    invalidate();
  }, [definition, textures, width, height, invalidate]);

  if (!textures || !definition || textures.materialId !== definition.id) {
    return { map: null, normalMap: null, roughnessMap: null, color: definition?.color ?? color, roughness: definition?.roughness ?? 0.86, metalness: 0, onUpdate: refreshMaterialProgram };
  }
  return {
    map: textures.map,
    normalMap: textures.normalMap,
    roughnessMap: textures.roughnessMap,
    normalScale: textures.normalScale,
    color: "#ffffff",
    roughness: 1,
    metalness: 0,
    onUpdate: refreshMaterialProgram,
  };
}
