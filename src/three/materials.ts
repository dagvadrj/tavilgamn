"use client";
import * as THREE from "three";
import type { Material } from "@/lib/types";

export interface MeshMaterialOpts {
  color: string;
  material: Material;
}

/** Build a Three.js standard material matching the chosen furniture material. */
export function makeMaterial({ color, material }: MeshMaterialOpts) {
  const base = new THREE.Color(color);
  switch (material) {
    case "wood":
      return new THREE.MeshStandardMaterial({
        color: base,
        roughness: 0.65,
        metalness: 0.05,
      });
    case "metal":
      return new THREE.MeshStandardMaterial({
        color: base,
        roughness: 0.25,
        metalness: 0.85,
      });
    case "leather":
      return new THREE.MeshStandardMaterial({
        color: base,
        roughness: 0.55,
        metalness: 0.0,
      });
    case "velvet":
      return new THREE.MeshStandardMaterial({
        color: base,
        roughness: 0.95,
        metalness: 0.0,
      });
    case "fabric":
    default:
      return new THREE.MeshStandardMaterial({
        color: base,
        roughness: 0.8,
        metalness: 0.0,
      });
  }
}

/** Slight cushion color shift to keep upholstery from looking flat. */
export function cushionColor(hex: string, amt = -0.06): string {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amt);
  return `#${c.getHexString()}`;
}
