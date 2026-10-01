import type { CabinetPose, KitchenRoom, ModularKitchen } from "./kitchenCabinets";
import type { Category, Material, Product } from "./types";
import { cabinetCorners, cabinetsOverlap } from "./kitchenPlacement";

export const EXTRA_CATEGORIES: readonly Category[] = ["dining-table", "office", "bookshelf", "tv-stand", "sofa"];
export type KitchenExtra = {
  id: string; productId: string; name: string; category: Category;
  width: number; height: number; depth: number; position: CabinetPose;
  color: string; material: Material; model?: Product["model"];
};
export function parseKitchenExtras(value: unknown, ids: Set<string>, room: KitchenRoom): KitchenExtra[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 40) throw new Error("Нэмэлт тавилга 40 хүртэл байна.");
  return value.map(raw => {
    if (!raw || typeof raw !== "object" || typeof raw.id !== "string" || !/^[a-z0-9_-]{1,80}$/i.test(raw.id) || ids.has(raw.id) ||
        typeof raw.productId !== "string" || !/^[a-z0-9_-]{1,100}$/i.test(raw.productId) || typeof raw.name !== "string" || !raw.name.trim() || raw.name.length > 120 ||
        !EXTRA_CATEGORIES.includes(raw.category) || ![raw.width,raw.depth,raw.height].every(n => Number.isInteger(n) && n > 0 && n <= 4000) ||
        !raw.position || ![raw.position.x,raw.position.z,raw.position.rotation].every(Number.isFinite) || raw.position.y !== 0 || raw.height > room.height ||
        !/^#[a-f0-9]{6}$/i.test(raw.color) || !["wood","metal","fabric","leather","velvet"].includes(raw.material)) throw new Error("Нэмэлт тавилгын мэдээлэл буруу байна.");
    ids.add(raw.id);
    let model: KitchenExtra["model"];
    if (raw.model !== undefined) {
      const m = raw.model;
      if (!m || !/^[0-9a-f-]{36}$/i.test(m.id) || !/^[a-z0-9._-]+\.glb$/i.test(m.file) ||
          (m.previewFile !== undefined && !/^[a-z0-9._-]+\.glb$/i.test(m.previewFile)) || m.scale !== 1) throw new Error("Нэмэлт тавилгын GLB мэдээлэл буруу байна.");
      model = { id:m.id, file:m.file, scale:1, ...(m.previewFile ? {previewFile:m.previewFile} : {}) };
    }
    return { id:raw.id, productId:raw.productId, name:raw.name.trim(), category:raw.category, width:raw.width, height:raw.height, depth:raw.depth,
      position:{x:raw.position.x,y:0,z:raw.position.z,rotation:raw.position.rotation}, color:raw.color, material:raw.material, ...(model ? {model} : {}) };
  });
}
export function extraFromProduct(product: Product, id: string): KitchenExtra {
  return { id, productId:product.id, name:product.name, category:product.category,
    width:Math.round(product.dimensions.w*1000), height:Math.round(product.dimensions.h*1000), depth:Math.round(product.dimensions.d*1000),
    position:{x:0,y:0,z:0,rotation:0}, color:product.colors.find(c=>c.id===product.defaultColor)?.hex ?? "#c9a37a", material:product.materials[0]?.id ?? "wood",
    ...(product.model ? {model:{...product.model,scale:1}} : {}) };
}
export function findExtraSpace(kitchen: ModularKitchen, extra: KitchenExtra): KitchenExtra | null {
  const positions = [{x:kitchen.room.width/2,z:kitchen.room.depth/2}];
  for(let z=extra.depth/2;z<=kitchen.room.depth-extra.depth/2;z+=150)
    for(let x=extra.width/2;x<=kitchen.room.width-extra.width/2;x+=150) positions.push({x,z});
  const obstacles=[...kitchen.cabinets,...(kitchen.extras??[])];
  for(const position of positions) {
    const candidate={...extra,position:{...extra.position,...position}};
    if(cabinetCorners(candidate).some(p=>p.x<0||p.z<0||p.x>kitchen.room.width||p.z>kitchen.room.depth)||obstacles.some(item=>cabinetsOverlap(candidate,item)))continue;
    return candidate;
  }
  return null;
}
