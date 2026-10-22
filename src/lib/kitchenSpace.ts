import { roomWalls, type KitchenRoom, type KitchenSpaceItem } from "./kitchenCabinets";
import { onRoomSegment, roomContainsFootprint, validateRoomOutline } from "./kitchenRoomOutline";

export const DEFAULT_KITCHEN_WALL_COLOR = "#eeede7";

export function parseKitchenSpace(room: KitchenRoom): Pick<KitchenRoom, "openFront" | "items" | "wallColors" | "outline"> {
  const outline = validateRoomOutline(room);
  if (room.openFront !== undefined && typeof room.openFront !== "boolean") throw new Error("Өрөөний хэлбэр буруу байна.");
  let wallColors: KitchenRoom["wallColors"];
  if (room.wallColors !== undefined) {
    if (!room.wallColors || typeof room.wallColors !== "object" || Array.isArray(room.wallColors) || Object.entries(room.wallColors).some(([wall, color]) => !["back", "front", "left", "right"].includes(wall) || typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color))) throw new Error("Ханын өнгө буруу байна.");
    wallColors = { ...room.wallColors };
  }
  const appearance = { ...(outline ? {outline} : {}), ...(room.openFront === undefined ? {} : { openFront: room.openFront }), ...(wallColors ? { wallColors } : {}) };
  if (room.items === undefined) return appearance;
  if (!Array.isArray(room.items) || room.items.length > 100) throw new Error("Өрөөний элементүүд буруу байна.");
  const ids = new Set<string>();
  const items = room.items.map((item: KitchenSpaceItem) => {
    if (!item || typeof item.id !== "string" || !item.id || item.id.length > 100 || ids.has(item.id) ||
      !["door", "window", "column", "water", "power", "vent"].includes(item.kind) || !["back", "front", "left", "right"].includes(item.wall) ||
      ![item.x, item.z, item.width, item.depth].every(Number.isFinite) || item.x < 0 || item.x > room.width || item.z < 0 || item.z > room.depth ||
      item.width < 50 || item.width > 3000 || item.depth < 50 || item.depth > 3000) throw new Error("Өрөөний элементийн хэмжээ, байрлал буруу байна.");
    if (item.kind === "column" && (item.x < item.width / 2 || item.x + item.width / 2 > room.width || item.z < item.depth / 2 || item.z + item.depth / 2 > room.depth)) throw new Error("Багана өрөөний хилээс гарсан байна.");
    if (["door", "window"].includes(item.kind)) {
      const sill = item.kind === "door" ? 0 : item.sillHeight ?? 900;
      const openingHeight = item.height ?? Math.min(item.kind === "door" ? 2100 : 1100, room.height - 100 - sill);
      if ((item.sillHeight !== undefined && (!Number.isFinite(item.sillHeight) || item.sillHeight < 0 || (item.kind === "door" && item.sillHeight !== 0))) ||
        !Number.isFinite(openingHeight) || openingHeight < 300 || sill + openingHeight > room.height ||
        (item.swing !== undefined && !["inward", "outward"].includes(item.swing))) throw new Error("Хаалга, цонхны өндөр, тавцангийн түвшин эсвэл нээлтийн чиглэл буруу байна.");
      const horizontal = ["back", "front"].includes(item.wall);
      const centre = horizontal ? item.x : item.z, extent = horizontal ? room.width : room.depth;
      if (outline) {
        const fits=roomWalls(room).some(w=>{
          if(w.sourceWall!==item.wall || !onRoomSegment(item,w.start,w.end)) return false;
          // Existing openings keep their orientation and measured size.
          if(horizontal ? Math.abs(w.start.z-w.end.z)>0.001 : Math.abs(w.start.x-w.end.x)>0.001) return false;
          return Math.hypot(item.x-w.start.x,item.z-w.start.z)>=item.width/2 && Math.hypot(item.x-w.end.x,item.z-w.end.z)>=item.width/2;
        });
        if(!fits) throw new Error("Хаалга, цонх шинэ ханын хэсэгт багтахгүй байна. Байрлалыг нь эхлээд өөрчилнө үү.");
      } else if (centre < item.width / 2 || centre + item.width / 2 > extent || (item.wall === "back" && item.z !== 0) || (item.wall === "front" && item.z !== room.depth) || (item.wall === "left" && item.x !== 0) || (item.wall === "right" && item.x !== room.width) || (room.openFront && item.wall === "front")) throw new Error("Хаалга, цонх ханын хэмжээнд багтахгүй байна.");
    }
    ids.add(item.id);
    if(outline && item.kind==="column" && !roomContainsFootprint(room,[{x:item.x-item.width/2,z:item.z-item.depth/2},{x:item.x+item.width/2,z:item.z-item.depth/2},{x:item.x+item.width/2,z:item.z+item.depth/2},{x:item.x-item.width/2,z:item.z+item.depth/2}])) throw new Error("Багана өрөөний хүрээнээс гарсан байна.");
    return { id: item.id, kind: item.kind, x: item.x, z: item.z, width: item.width, depth: item.depth, wall: item.wall,
      ...(item.height !== undefined ? { height: item.height } : {}), ...(item.sillHeight !== undefined ? { sillHeight: item.sillHeight } : {}),
      ...(item.swing !== undefined ? { swing: item.swing } : {}) };
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
      if (["water", "power", "vent"].includes(item.kind) && item.kind === other.kind && Math.hypot(item.x - other.x, item.z - other.z) < 100)
        throw new Error(item.kind === "water" ? "Энэ байрлалд усны цэг байна." : "Энэ байрлалд холболтын цэг байна.");
    }
  }
  return { ...appearance, items };
}

/** Keep wall attachments and relative positions when resizing the room. */
export function resizeKitchenRoom(room: KitchenRoom, patch: Partial<Pick<KitchenRoom, "width" | "depth" | "height">>): KitchenRoom {
  const next = { ...room, ...patch };
  if(room.outline) next.outline=room.outline.map(p=>({...p,x:p.x*next.width/room.width,z:p.z*next.depth/room.depth,...(p.curve?{curve:{x:p.curve.x*next.width/room.width,z:p.curve.z*next.depth/room.depth}}:{})}));
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  next.items = room.items?.map(item => {
    let x = Math.round(item.x * next.width / room.width), z = Math.round(item.z * next.depth / room.depth);
    if (["door", "window"].includes(item.kind)) {
      if (room.outline) {
        const wall = roomWalls(next).find(w => w.sourceWall === item.wall && onRoomSegment({x,z},w.start,w.end));
        if (wall && (item.wall === "back" || item.wall === "front")) x=clamp(x,Math.min(wall.start.x,wall.end.x)+item.width/2,Math.max(wall.start.x,wall.end.x)-item.width/2);
        else if (wall) z=clamp(z,Math.min(wall.start.z,wall.end.z)+item.width/2,Math.max(wall.start.z,wall.end.z)-item.width/2);
      } else if (item.wall === "back" || item.wall === "front") { x = clamp(x, item.width / 2, next.width - item.width / 2); z = item.wall === "back" ? 0 : next.depth; }
      else { z = clamp(z, item.width / 2, next.depth - item.width / 2); x = item.wall === "left" ? 0 : next.width; }
    } else if (item.kind === "column") {
      x = clamp(x, item.width / 2, next.width - item.width / 2); z = clamp(z, item.depth / 2, next.depth - item.depth / 2);
    }
    return { ...item, x, z };
  });
  parseKitchenSpace(next);
  return next;
}

export function spaceItemCandidates(room: KitchenRoom, kind: KitchenSpaceItem["kind"], wall: KitchenSpaceItem["wall"], id: string, openingWidth?: number): KitchenSpaceItem[] {
  const activeWall = room.openFront && wall === "front" ? "back" : wall;
  const width = kind === "door" ? (openingWidth ?? 900) : kind === "window" ? (openingWidth ?? 1200) : kind === "column" ? 400 : kind === "vent" ? 120 : 100;
  const depth = kind === "column" ? 400 : 100;
  const candidates: KitchenSpaceItem[] = [];
  const add = (x: number, z: number) => candidates.push({ id, kind, wall: activeWall, width, depth, x: Math.round(x), z: Math.round(z) });
  if (["door", "window", "water", "power", "vent"].includes(kind)) {
    const horizontal = activeWall === "back" || activeWall === "front";
    const extent = horizontal ? room.width : room.depth;
    const positions = [extent / 2];
    if (!["door", "window"].includes(kind)) positions.push(extent * 0.72, extent * 0.28);
    for (let position = width / 2; position <= extent - width / 2; position += 100) positions.push(position);
    for (const position of positions) add(horizontal ? position : activeWall === "left" ? 0 : room.width, horizontal ? activeWall === "back" ? 0 : room.depth : position);
  } else {
    add(room.width / 2, room.depth / 2);
    for (let x = width / 2; x <= room.width - width / 2; x += 400)
      for (let z = depth / 2; z <= room.depth - depth / 2; z += 400) add(x, z);
  }
  return candidates;
}
