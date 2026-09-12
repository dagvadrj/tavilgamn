import type { PlacedFurniture } from "./types";
import { cloneKitchen, type KitchenSnapshot } from "./kitchenAssembly";

export function kitchenRoomPiece(saved: KitchenSnapshot, instanceId: string): PlacedFurniture {
  return { instanceId, productId: `kitchen:${saved.id}`, x: 0, z: 0, rotation: 0,
    color: saved.design.cabinets[0]?.color ?? "#ddd8cc", material: "wood",
    kitchen: { id: saved.id, name: saved.name, design: cloneKitchen(saved.design) } };
}
