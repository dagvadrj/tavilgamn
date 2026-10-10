import type { KitchenRoom, KitchenSpaceItem } from "./kitchenCabinets";

export function parseKitchenSpace(room: KitchenRoom): Pick<KitchenRoom, "openFront" | "items"> {
  if (room.openFront !== undefined && typeof room.openFront !== "boolean") throw new Error("Өрөөний хэлбэр буруу байна.");
  if (room.items === undefined) return room.openFront === undefined ? {} : { openFront: room.openFront };
  if (!Array.isArray(room.items) || room.items.length > 100) throw new Error("Өрөөний элементүүд буруу байна.");
  const ids = new Set<string>();
  const items = room.items.map((item: KitchenSpaceItem) => {
    if (!item || typeof item.id !== "string" || !item.id || item.id.length > 100 || ids.has(item.id) ||
      !["door", "window", "column", "water"].includes(item.kind) || !["back", "front", "left", "right"].includes(item.wall) ||
      ![item.x, item.z, item.width, item.depth].every(Number.isFinite) || item.x < 0 || item.x > room.width || item.z < 0 || item.z > room.depth ||
      item.width < 50 || item.width > 3000 || item.depth < 50 || item.depth > 3000) throw new Error("Өрөөний элементийн хэмжээ, байрлал буруу байна.");
    if (item.kind === "column" && (item.x < item.width / 2 || item.x + item.width / 2 > room.width || item.z < item.depth / 2 || item.z + item.depth / 2 > room.depth)) throw new Error("Багана өрөөний хилээс гарсан байна.");
    if (["door", "window"].includes(item.kind)) {
      const horizontal = ["back", "front"].includes(item.wall);
      const centre = horizontal ? item.x : item.z, extent = horizontal ? room.width : room.depth;
      if (centre < item.width / 2 || centre + item.width / 2 > extent || (item.wall === "back" && item.z !== 0) || (item.wall === "front" && item.z !== room.depth) || (item.wall === "left" && item.x !== 0) || (item.wall === "right" && item.x !== room.width) || (room.openFront && item.wall === "front")) throw new Error("Хаалга, цонх ханын хэмжээнд багтахгүй байна.");
    }
    ids.add(item.id);
    return { id: item.id, kind: item.kind, x: item.x, z: item.z, width: item.width, depth: item.depth, wall: item.wall };
  });
  for (const [index, item] of items.entries()) {
    for (const other of items.slice(index + 1)) {
      const openings = ["door", "window"];
      if (openings.includes(item.kind) && openings.includes(other.kind) && item.wall === other.wall) {
        const horizontal = ["back", "front"].includes(item.wall);
        if (Math.abs((horizontal ? item.x : item.z) - (horizontal ? other.x : other.z)) < (item.width + other.width) / 2)
          throw new Error("Хаалга, цонх хоорондоо давхцаж байна. Ханын дагуу байрлалыг нь өөрчлөөрэй.");
      }
      if (item.kind === "column" && other.kind === "column" && Math.abs(item.x - other.x) < (item.width + other.width) / 2 && Math.abs(item.z - other.z) < (item.depth + other.depth) / 2)
        throw new Error("Баганууд давхцаж байна.");
      if (item.kind === "water" && other.kind === "water" && Math.hypot(item.x - other.x, item.z - other.z) < 100)
        throw new Error("Энэ байрлалд усны цэг байна.");
    }
  }
  return { ...(room.openFront === undefined ? {} : { openFront: room.openFront }), items };
}

/** Keep wall attachments and relative positions when resizing the room. */
export function resizeKitchenRoom(room: KitchenRoom, patch: Partial<Pick<KitchenRoom, "width" | "depth" | "height">>): KitchenRoom {
  const next = { ...room, ...patch };
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  next.items = room.items?.map(item => {
    let x = Math.round(item.x * next.width / room.width), z = Math.round(item.z * next.depth / room.depth);
    if (["door", "window"].includes(item.kind)) {
      if (item.wall === "back" || item.wall === "front") { x = clamp(x, item.width / 2, next.width - item.width / 2); z = item.wall === "back" ? 0 : next.depth; }
      else { z = clamp(z, item.width / 2, next.depth - item.width / 2); x = item.wall === "left" ? 0 : next.width; }
    } else if (item.kind === "column") {
      x = clamp(x, item.width / 2, next.width - item.width / 2); z = clamp(z, item.depth / 2, next.depth - item.depth / 2);
    }
    return { ...item, x, z };
  });
  parseKitchenSpace(next);
  return next;
}

export function spaceItemCandidates(room: KitchenRoom, kind: KitchenSpaceItem["kind"], wall: KitchenSpaceItem["wall"], id: string): KitchenSpaceItem[] {
  const activeWall = room.openFront && wall === "front" ? "back" : wall;
  const width = kind === "door" ? 900 : kind === "window" ? 1200 : kind === "column" ? 400 : 100;
  const depth = kind === "column" ? 400 : 100;
  const candidates: KitchenSpaceItem[] = [];
  const add = (x: number, z: number) => candidates.push({ id, kind, wall: activeWall, width, depth, x: Math.round(x), z: Math.round(z) });
  if (["door", "window"].includes(kind)) {
    const horizontal = activeWall === "back" || activeWall === "front";
    const extent = horizontal ? room.width : room.depth;
    const positions = [extent / 2];
    for (let position = width / 2; position <= extent - width / 2; position += 100) positions.push(position);
    for (const position of positions) add(horizontal ? position : activeWall === "left" ? 0 : room.width, horizontal ? activeWall === "back" ? 0 : room.depth : position);
  } else {
    add(room.width / 2, room.depth / 2);
    for (let x = width / 2; x <= room.width - width / 2; x += 400)
      for (let z = depth / 2; z <= room.depth - depth / 2; z += 400) add(x, z);
  }
  return candidates;
}
