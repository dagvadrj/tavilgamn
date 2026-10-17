"use client";

import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { RectAreaLight, UniformsLib } from "three";
import { RectAreaLightUniformsLib } from "three-stdlib";
import type { RoomShape } from "@/lib/types";
import { openingWorldTransform } from "@/lib/roomOpenings";

/** A broad daylight source, with a ceiling fill for rooms without windows. */
export function RoomDaylightFill({ design, daylight }: { design: RoomShape; daylight: number }) {
  const invalidate = useThree(state => state.invalidate);
  const window = (design.openings ?? []).filter(opening => opening.kind === "window")
    .sort((a, b) => b.width * b.height - a.width * a.height || a.id.localeCompare(b.id))[0];
  const { x, z, rotation } = window ? openingWorldTransform(design, window) : { x: 0, z: 0, rotation: 0 };
  const width = window?.width ?? Math.min(4, design.width * 0.65);
  const height = window?.height ?? Math.min(4, design.depth * 0.65);
  const sill = window?.sillHeight ?? 0;
  const ceilingY = window ? 0 : (design.height ?? 2.7) - 0.12;
  const light = useMemo(() => {
    if (width <= 0 || height <= 0 || daylight <= 0) return null;
    const nx = Math.sin(rotation), nz = Math.cos(rotation);
    const light = new RectAreaLight(ceilingY ? "#fff6e8" : "#eef4ff", (ceilingY ? 4 : 7) * daylight, width, height);
    if (ceilingY) {
      light.position.set(0, ceilingY, 0);
      light.rotation.x = -Math.PI / 2;
      return light;
    }
    const y = sill + height / 2;
    // Keep the emitter inside the glass/frame; face into the room, never at the camera.
    light.position.set(x + nx * 0.09, y, z + nz * 0.09);
    light.lookAt(x + nx, y, z + nz);
    return light;
  }, [x, z, rotation, width, height, sill, ceilingY, daylight]);
  useEffect(() => {
    if (!light) return;
    // These shared lookup textures must not be reallocated for every room/update.
    if (!("LTC_HALF_1" in UniformsLib)) RectAreaLightUniformsLib.init();
    invalidate();
    return () => { light.dispose(); };
  }, [light, invalidate]);
  return light ? <primitive object={light} /> : null;
}
