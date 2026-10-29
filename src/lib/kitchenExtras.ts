import type {
  CabinetPose,
  KitchenRoom,
  ModularKitchen,
} from "./kitchenCabinets";
import { roomWalls } from "./kitchenCabinets";
import type { Category, Material, Product } from "./types";
import { cabinetCorners, cabinetsOverlap, fitCountertops } from "./kitchenPlacement";
import { roomContainsFootprint } from "./kitchenRoomOutline";
import { pcmallAppliance } from "./pcmallAppliances";
import { validPlanningFurniture, type KitchenPlanningFurnitureKind } from "./kitchenPlanningFurniture";
import {
  kitchenAsset,
  parseKitchenAsset,
  type KitchenAsset,
} from "./kitchenAssetCatalog";

export const EXTRA_CATEGORIES: readonly Category[] = [
  "dining-table",
  "chair",
  "office",
  "bookshelf",
  "tv-stand",
  "sofa",
  "kitchen-cabinet",
];
export type KitchenExtra = {
  id: string;
  productId: string;
  name: string;
  category: Category;
  width: number;
  height: number;
  depth: number;
  position: CabinetPose;
  color: string;
  material: Material;
  model?: Product["model"];
  asset?: KitchenAsset;
  planningFurniture?: KitchenPlanningFurnitureKind;
};
export function parseKitchenExtras(
  value: unknown,
  ids: Set<string>,
  room: KitchenRoom,
): KitchenExtra[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 40)
    throw new Error("Нэмэлт тавилга 40 хүртэл байна.");
  return value.map((raw) => {
    if (
      !raw ||
      typeof raw !== "object" ||
      typeof raw.id !== "string" ||
      !/^[a-z0-9_-]{1,80}$/i.test(raw.id) ||
      ids.has(raw.id) ||
      typeof raw.productId !== "string" ||
      !/^[a-z0-9_-]{1,100}$/i.test(raw.productId) ||
      typeof raw.name !== "string" ||
      !raw.name.trim() ||
      raw.name.length > 120 ||
      !EXTRA_CATEGORIES.includes(raw.category) ||
      ![raw.width, raw.depth, raw.height].every(
        (n) => Number.isInteger(n) && n > 0 && n <= 4000,
      ) ||
      !raw.position ||
      ![
        raw.position.x,
        raw.position.y,
        raw.position.z,
        raw.position.rotation,
      ].every(Number.isFinite) ||
      raw.position.y < 0 ||
      raw.position.y + raw.height > room.height ||
      !/^#[a-f0-9]{6}$/i.test(raw.color) ||
      !["wood", "metal", "fabric", "leather", "velvet"].includes(raw.material)
    )
      throw new Error("Нэмэлт тавилгын мэдээлэл буруу байна.");
    ids.add(raw.id);
    if (raw.planningFurniture !== undefined && (!validPlanningFurniture(raw.planningFurniture, raw) || raw.category !== "dining-table" || raw.model || raw.asset || raw.position.y !== 0))
      throw new Error("Тек эсвэл арлын хэмжээ буруу байна.");
    const asset =
      raw.asset !== undefined ? parseKitchenAsset(raw.asset) : undefined;
    if (
      raw.category === "kitchen-cabinet" &&
      (!asset || (!raw.model || !pcmallAppliance(raw.productId, raw.model)) && (
        asset.installation === "integrated" ||
        asset.placement === "cabinet"))
    )
      throw new Error(
        "Суурилуулдаг хэрэгслийг шүүгээний эд ангиар холбоно уу.",
      );
    if (!asset && raw.position.y !== 0)
      throw new Error("Нэмэлт тавилга шалан дээр байрлана.");
    let model: KitchenExtra["model"];
    if (raw.model !== undefined) {
      const m = raw.model;
      if (
        !m ||
        !/^[0-9a-f-]{36}$/i.test(m.id) ||
        !/^[a-z0-9._-]+\.glb$/i.test(m.file) ||
        (m.previewFile !== undefined &&
          !/^[a-z0-9._-]+\.glb$/i.test(m.previewFile)) ||
        m.scale !== 1
      )
        throw new Error("Нэмэлт тавилгын GLB мэдээлэл буруу байна.");
      model = { id: m.id, file: m.file, scale: 1 };
    }
    return {
      id: raw.id,
      productId: raw.productId,
      name: raw.name.trim(),
      category: raw.category,
      width: raw.width,
      height: raw.height,
      depth: raw.depth,
      position: {
        x: raw.position.x,
        y: raw.position.y,
        z: raw.position.z,
        rotation: raw.position.rotation,
      },
      color: raw.color,
      material: raw.material,
      ...(model ? { model } : {}),
      ...(asset ? { asset } : {}),
      ...(raw.planningFurniture ? { planningFurniture: raw.planningFurniture } : {}),
    };
  });
}
export function extraFromProduct(product: Product, id: string): KitchenExtra {
  const asset = kitchenAsset(product.specifications);
  return {
    id,
    productId: product.id,
    name: product.name,
    category: product.category,
    width: Math.round(product.dimensions.w * 1000),
    height: Math.round(product.dimensions.h * 1000),
    depth: Math.round(product.dimensions.d * 1000),
    position: { x: 0, y: 0, z: 0, rotation: 0 },
    color:
      product.colors.find((c) => c.id === product.defaultColor)?.hex ??
      "#c9a37a",
    material: product.materials[0]?.id ?? "wood",
    ...(product.model ? { model: { ...product.model, scale: 1 } } : {}),
    ...(asset ? { asset } : {}),
  };
}
export function findExtraSpace(
  kitchen: ModularKitchen,
  extra: KitchenExtra,
): KitchenExtra | null {
  const imported = extra.model ? pcmallAppliance(extra.productId, extra.model) : undefined;
  if (
    !imported && (extra.asset?.installation === "integrated" ||
    extra.asset?.placement === "cabinet")
  )
    return null;
  // Integrated imports reserve their own volume; they never replace cabinet
  // geometry or silently cut a countertop. Their source installation is retained.
  const placement = imported?.planningPlacement ?? extra.asset?.placement;
  const y =
    placement === "ceiling"
      ? kitchen.room.height - extra.height
      : placement === "wall"
        ? Math.min(1450, kitchen.room.height - extra.height)
        : extra.position.y;
  if (y < 0 || y + extra.height > kitchen.room.height) return null;
  const positions: CabinetPose[] = [];
  if (placement === "countertop") {
    for (const top of fitCountertops(kitchen).filter(
      (top) => top.width >= extra.width && top.depth >= extra.depth,
    )) {
      const offsets = [0];
      const end = (top.width - extra.width) / 2;
      for (let offset = -end; offset <= end; offset += 150) offsets.push(offset);
      offsets.push(end);
      for (const offset of offsets) positions.push({
        ...top.position,
        x: top.position.x + Math.cos(top.position.rotation) * offset,
        z: top.position.z - Math.sin(top.position.rotation) * offset,
        y: top.position.y + top.thickness,
      });
    }
  } else if (placement === "wall") {
    for (const wall of roomWalls(kitchen.room)) {
      const dx = wall.end.x - wall.start.x,
        dz = wall.end.z - wall.start.z,
        length = Math.hypot(dx, dz);
      for (
        let along = extra.width / 2;
        along <= length - extra.width / 2;
        along += 150
      )
        positions.push({
          x:
            wall.start.x +
            (dx * along) / length +
            (wall.inward.x * extra.depth) / 2,
          z:
            wall.start.z +
            (dz * along) / length +
            (wall.inward.z * extra.depth) / 2,
          y,
          rotation: Math.atan2(wall.inward.x, wall.inward.z),
        });
    }
  } else {
    positions.push({
      x: kitchen.room.width / 2,
      z: kitchen.room.depth / 2,
      y,
      rotation: extra.position.rotation,
    });
    for (
      let z = extra.depth / 2;
      z <= kitchen.room.depth - extra.depth / 2;
      z += 150
    )
      for (
        let x = extra.width / 2;
        x <= kitchen.room.width - extra.width / 2;
        x += 150
      )
        positions.push({ x, z, y, rotation: extra.position.rotation });
  }
  const obstacles = [...kitchen.cabinets, ...(kitchen.extras ?? [])];
  for (const position of positions) {
    const candidate = {
      ...extra,
      position,
    };
    if (
      !roomContainsFootprint(kitchen.room, cabinetCorners(candidate)) ||
      position.y < 0 ||
      position.y + candidate.height > kitchen.room.height ||
      obstacles.some((item) => cabinetsOverlap(candidate, item))
    )
      continue;
    return candidate;
  }
  return null;
}
