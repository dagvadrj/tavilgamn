import type { CabinetPose, KitchenSpaceItem, ModularCabinet, ModularKitchen } from "./kitchenCabinets";
import type { KitchenExtra } from "./kitchenExtras";
import { cabinetAxes, fitCountertops } from "./kitchenPlacement";
import { hasCooktop } from "./plitka";

/**
 * Where the electrician and plumber bring each connection. Points sit on the
 * wall (or the splashback face) so the 3D view can draw them where they really
 * are; `hidden` marks the ones a cabinet or appliance covers.
 */
export type KitchenServiceKind =
  | "socket" | "socket-double" | "cooker-outlet" | "appliance-socket"
  | "water-cold" | "water-hot" | "drain";
export interface KitchenServicePoint {
  id: string;
  kind: KitchenServiceKind;
  label: string;
  /** Centre on the wall surface, mm. */
  x: number; y: number; z: number;
  /** Rotation of the wall face, same convention as cabinets. */
  rotation: number;
  /** Faceplate size, mm. */
  width: number; height: number;
  hidden: boolean;
  /** Sockets cut into the splashback tiles. */
  onBacksplash: boolean;
  /** The unit it serves. */
  forId?: string;
}
export interface KitchenDuctRun { id: string; points: { x: number; y: number; z: number }[]; length: number; bends: number; forId: string }
export interface KitchenServiceNote { code: "water" | "drain" | "vent" | "cooker" | "sockets" | "power"; severity: "info" | "warning"; message: string; ids: string[] }
export interface KitchenServicePlan { points: KitchenServicePoint[]; ducts: KitchenDuctRun[]; notes: KitchenServiceNote[] }

/** Above the worktop: clear of the hob's heat and the sink's splash. */
const HEAT_CLEARANCE = 150;
const WET_CLEARANCE = 150;
const END_MARGIN = 120;
const SOCKET = { single: 86, double: 146, height: 86 };
/** Typical wall vent / duct height when the room survey gives only a plan position. */
export const VENT_HEIGHT_FROM_CEILING = 250;
/** Wall-mounted outlets are drawn 1 mm proud of the surface. */
const PROUD = 1;

type Box = Pick<ModularCabinet, "id" | "width" | "depth" | "height" | "position">;
const dot = (a: { x: number; z: number }, b: { x: number; z: number }) => a.x * b.x + a.z * b.z;

/** A point on the back face of a unit, `along` from its centre and `y` above the floor. */
function behind(box: Pick<Box, "depth" | "position">, along: number, y: number, inset = 0): Pick<KitchenServicePoint, "x" | "y" | "z" | "rotation"> {
  const { right, front } = cabinetAxes(box.position.rotation);
  const back = box.depth / 2 - inset - PROUD;
  return {
    x: Math.round(box.position.x + right.x * along - front.x * back),
    z: Math.round(box.position.z + right.z * along - front.z * back),
    y: Math.round(y), rotation: box.position.rotation,
  };
}

/** True when a unit stands in front of a wall point (and covers its height). */
export function coversPoint(box: Box, point: { x: number; y: number; z: number }, margin = 0) {
  const { right, front } = cabinetAxes(box.position.rotation);
  const d = { x: point.x - box.position.x, z: point.z - box.position.z };
  const along = dot(d, right), across = dot(d, front);
  return Math.abs(along) <= box.width / 2 - margin && across >= -box.depth / 2 - 40 && across <= box.depth / 2 &&
    point.y >= box.position.y + margin && point.y <= box.position.y + box.height - margin;
}

const isHood = (item: ModularCabinet | KitchenExtra) =>
  "opening" in item ? item.opening === "hood" : (item as KitchenExtra).asset?.type === "hood";
const isFridge = (item: ModularCabinet | KitchenExtra) =>
  "opening" in item ? item.opening === "refrigerator" : ["fridge", "freezer", "wine-cooler"].includes((item as KitchenExtra).asset?.type ?? "");

function wallBacked(kitchen: ModularKitchen, pose: CabinetPose, depth: number) {
  const { front } = cabinetAxes(pose.rotation);
  const x = pose.x - front.x * depth / 2, z = pose.z - front.z * depth / 2;
  const { width, depth: roomDepth } = kitchen.room;
  return x < 5 || z < 5 || x > width - 5 || z > roomDepth - 5;
}

/** Spread sockets over the free worktop stretches of each wall run. */
function worktopSockets(kitchen: ModularKitchen): KitchenServicePoint[] {
  const points: KitchenServicePoint[] = [];
  const backsplash = !!kitchen.backsplash;
  const splashThickness = backsplash ? 12 : 0;
  for (const top of fitCountertops(kitchen)) {
    if (!wallBacked(kitchen, top.position, top.depth)) continue;
    const { right } = cabinetAxes(top.position.rotation);
    const blocked: [number, number][] = [];
    for (const c of kitchen.cabinets) {
      if (!top.cabinetIds.includes(c.id)) continue;
      const along = dot({ x: c.position.x - top.position.x, z: c.position.z - top.position.z }, right);
      if (c.opening === "sink") blocked.push([along - c.width / 2 - WET_CLEARANCE, along + c.width / 2 + WET_CLEARANCE]);
      if (hasCooktop(c)) blocked.push([along - c.width / 2 - HEAT_CLEARANCE, along + c.width / 2 + HEAT_CLEARANCE]);
    }
    const surface = top.position.y + top.thickness;
    const y = surface + Math.min(180, Math.max(100, kitchen.wallClearance - 150));
    // Windows down to the worktop leave no wall for an outlet.
    for (const item of kitchen.room.items ?? []) {
      if (item.kind !== "window" && item.kind !== "door") continue;
      const sill = item.kind === "door" ? 0 : item.sillHeight ?? 900;
      if (sill > y + SOCKET.height) continue;
      const along = dot({ x: item.x - top.position.x, z: item.z - top.position.z }, right);
      const across = Math.abs(dot({ x: item.x - top.position.x, z: item.z - top.position.z }, cabinetAxes(top.position.rotation).front));
      if (across > top.depth / 2 + 60) continue;
      blocked.push([along - item.width / 2 - 50, along + item.width / 2 + 50]);
    }
    let cursor = -top.width / 2 + END_MARGIN;
    const end = top.width / 2 - END_MARGIN;
    const free: [number, number][] = [];
    for (const [a, b] of blocked.sort((p, q) => p[0] - q[0])) {
      if (a > cursor) free.push([cursor, Math.min(a, end)]);
      cursor = Math.max(cursor, b);
    }
    if (end > cursor) free.push([cursor, end]);
    for (const [a, b] of free) {
      const length = b - a;
      if (length < SOCKET.single) continue;
      const double = length >= SOCKET.double + 40;
      const count = double ? Math.min(3, Math.max(1, Math.round(length / 1200))) : 1;
      for (let i = 0; i < count; i++) {
        const along = a + length * (i + .5) / count;
        const pose = behind({ depth: top.depth, position: top.position }, along, y, splashThickness);
        points.push({ id: `socket:${top.id}:${points.length}`, kind: double ? "socket-double" : "socket",
          label: double ? "Тавцангийн давхар залгуур" : "Тавцангийн залгуур", ...pose,
          width: double ? SOCKET.double : SOCKET.single, height: SOCKET.height, hidden: false, onBacksplash: backsplash });
      }
    }
  }
  return points;
}

/** The unit next to `c` in its run that the outlet can sit behind (reachable by removing a drawer). */
function runNeighbour(kitchen: ModularKitchen, c: ModularCabinet) {
  const { right } = cabinetAxes(c.position.rotation);
  return kitchen.cabinets
    .filter(o => o.id !== c.id && o.type !== "wall" && Math.abs(Math.cos(o.position.rotation - c.position.rotation) - 1) < 1e-6)
    .map(o => ({ o, along: dot({ x: o.position.x - c.position.x, z: o.position.z - c.position.z }, right) }))
    .filter(({ o, along }) => Math.abs(Math.abs(along) - (o.width + c.width) / 2) < 5 && !["sink", "oven", "hob", "refrigerator"].includes(o.opening ?? "") && !hasCooktop(o))
    .sort((a, b) => Math.abs(a.along) - Math.abs(b.along))[0];
}

/** Every connection the design needs, with notes when a point is far from the room's supply. */
export function planKitchenServices(kitchen: ModularKitchen): KitchenServicePlan {
  const points: KitchenServicePoint[] = worktopSockets(kitchen);
  const notes: KitchenServiceNote[] = [];
  const ducts: KitchenDuctRun[] = [];
  const items = kitchen.room.items ?? [];
  const supply = (kind: KitchenSpaceItem["kind"]) => items.filter(item => item.kind === kind);
  const nearest = (kind: KitchenSpaceItem["kind"], at: { x: number; z: number }) =>
    supply(kind).map(item => ({ item, distance: Math.hypot(item.x - at.x, item.z - at.z) })).sort((a, b) => a.distance - b.distance)[0];

  for (const c of kitchen.cabinets) {
    if (c.opening === "sink") {
      const y = 500;
      points.push({ id: `water-cold:${c.id}`, kind: "water-cold", label: "Хүйтэн ус", ...behind(c, -80, y), width: 40, height: 40, hidden: true, onBacksplash: false, forId: c.id });
      points.push({ id: `water-hot:${c.id}`, kind: "water-hot", label: "Халуун ус", ...behind(c, 80, y), width: 40, height: 40, hidden: true, onBacksplash: false, forId: c.id });
      points.push({ id: `drain:${c.id}`, kind: "drain", label: "Бохир ус Ø50", ...behind(c, 0, 380), width: 60, height: 60, hidden: true, onBacksplash: false, forId: c.id });
      const neighbour = runNeighbour(kitchen, c);
      points.push({ id: `appliance-socket:${c.id}`, kind: "appliance-socket", label: "Аяга угаагч / шүүлтүүрийн залгуур",
        ...(neighbour ? behind(neighbour.o, 0, 400) : behind(c, c.width / 2 - 90, 400)), width: SOCKET.single, height: SOCKET.height, hidden: true, onBacksplash: false, forId: c.id });
      const water = nearest("water", c.position);
      if (!water) notes.push({ code: "water", severity: "warning", ids: [c.id], message: "Угаалтуур байгаа ч өрөөнд ус/бохирын цэг тэмдэглээгүй. Өрөөний алхамд усны цэгээ нэмнэ үү." });
      else if (water.distance > 600) {
        const drop = Math.round(water.distance * .02);
        notes.push({ code: "drain", severity: water.distance > 3000 ? "warning" : "info", ids: [c.id, water.item.id],
          message: `Угаалтуур усны цэгээс ${(water.distance / 1000).toFixed(1)} м зайтай. Бохирын хоолойг 2% налуугаар (≈${drop} мм уналт) сунгана${water.distance > 3000 ? " — 3 м-ээс урт тул угаалтуурыг усны цэг рүү ойртуулахыг зөвлөж байна" : ""}.` });
      }
    }
    if (hasCooktop(c)) {
      // Cooker outlet: never behind the oven's heat, reachable behind the next drawer unit.
      const neighbour = runNeighbour(kitchen, c);
      const pose = neighbour ? behind(neighbour.o, neighbour.along > 0 ? -neighbour.o.width / 2 + 120 : neighbour.o.width / 2 - 120, 300) : behind(c, c.width / 2 - 100, 300);
      points.push({ id: `cooker-outlet:${c.id}`, kind: "cooker-outlet", label: "Плитаны 32А тусгай залгуур (6 мм² кабель)",
        ...pose, width: 100, height: 100, hidden: true, onBacksplash: false, forId: c.id });
      notes.push({ code: "cooker", severity: neighbour ? "info" : "warning", ids: [c.id],
        message: neighbour
          ? "Плитаны 32А тусгай залгуурыг зэргэлдээх шүүгээний ард, шалнаас 300 мм өндөрт гаргана. Шарах шүүгээний ард халуунд байрлуулахгүй. Тусдаа 32А автомат таслууртай байна."
          : "Плитаны хажууд энгийн шүүгээ алга тул 32А залгуур плитаны ард үлдэж байна. Хажууд нь шүүгээ байрлуулах эсвэл залгуурыг хананы хажуу руу гаргана уу." });
    }
    if (c.type === "tall" && c.opening === "oven")
      points.push({ id: `appliance-socket:${c.id}`, kind: "appliance-socket", label: "Шарах шүүгээний 16А залгуур",
        ...behind(c, 0, 300), width: SOCKET.single, height: SOCKET.height, hidden: true, onBacksplash: false, forId: c.id });
  }

  for (const fridge of [...kitchen.cabinets, ...(kitchen.extras ?? [])].filter(isFridge))
    points.push({ id: `appliance-socket:${fridge.id}`, kind: "appliance-socket", label: "Хөргөгчийн залгуур",
      ...behind(fridge, fridge.width / 2 - 120, 450), width: SOCKET.single, height: SOCKET.height, hidden: true, onBacksplash: false, forId: fridge.id });

  for (const hood of [...kitchen.cabinets, ...(kitchen.extras ?? [])].filter(isHood)) {
    // Inside the chimney cover / hood housing, never on open wall above it.
    const y = hood.position.y + hood.height - 120;
    // Centred so a chimney cover or the cabinet above hides it.
    points.push({ id: `appliance-socket:${hood.id}`, kind: "appliance-socket", label: "Сорогчийн залгуур",
      ...behind(hood, 0, y), width: SOCKET.single, height: SOCKET.height, hidden: true, onBacksplash: false, forId: hood.id });
    const vent = nearest("vent", hood.position);
    if (!vent) {
      notes.push({ code: "vent", severity: "info", ids: [hood.id], message: "Агааржуулалтын цэг тэмдэглээгүй тул сорогч нүүрсэн шүүлтүүрээр (рециркуляц) ажиллана. Гадагш гаргах бол өрөөний алхамд агааржуулалтын цэгээ нэмнэ үү." });
      continue;
    }
    const run = ductRun(kitchen, hood, vent.item);
    ducts.push(run);
    const long = run.length > 3000 || run.bends > 3;
    notes.push({ code: "vent", severity: long ? "warning" : "info", ids: [hood.id, vent.item.id],
      message: `Сорогчийн хоолой ${(run.length / 1000).toFixed(1)} м, ${run.bends} тохой.${long ? " 3 м эсвэл 3 тохойноос их бол татах хүч мэдэгдэхүйц сулрах тул сорогчийг агааржуулалтын цэг рүү ойртуулна уу." : ""}` });
  }

  const sockets = points.filter(p => p.kind === "socket" || p.kind === "socket-double");
  if (kitchen.cabinets.some(c => c.type === "base") && !sockets.length)
    notes.push({ code: "sockets", severity: "warning", ids: [], message: "Тавцан дээр залгуур гаргах чөлөөтэй хана алга. Угаалтуур, плитаны хоорондох зайг нэмэгдүүлнэ үү." });
  if (!supply("power").length && points.some(p => p.kind !== "water-cold" && p.kind !== "water-hot" && p.kind !== "drain"))
    notes.push({ code: "power", severity: "info", ids: [], message: "Өрөөнд цахилгааны оролтын цэг тэмдэглээгүй. Кабелийн уртыг цахилгаанчин газар дээр нь тодруулна." });

  for (const point of points)
    if (!point.hidden && [...kitchen.cabinets, ...(kitchen.extras ?? [])].some(item => coversPoint(item, point, 2))) point.hidden = true;
  return { points, ducts, notes };
}

/** Duct from the hood top, up to vent height, then along the walls to the vent. */
function ductRun(kitchen: ModularKitchen, hood: ModularCabinet | KitchenExtra, vent: KitchenSpaceItem): KitchenDuctRun {
  const { front } = cabinetAxes(hood.position.rotation);
  const offset = hood.depth / 2 - 90; // Duct centre 90 mm off the wall.
  const start = { x: hood.position.x - front.x * offset, y: hood.position.y + hood.height, z: hood.position.z - front.z * offset };
  const height = Math.max(start.y + 100, kitchen.room.height - VENT_HEIGHT_FROM_CEILING);
  const wallOffset = (wall: KitchenSpaceItem["wall"]) => ({ back: { x: 0, z: 90 }, front: { x: 0, z: -90 }, left: { x: 90, z: 0 }, right: { x: -90, z: 0 } })[wall];
  const end = { x: vent.x + wallOffset(vent.wall).x, y: height, z: vent.z + wallOffset(vent.wall).z };
  const route = [start, { ...start, y: height }];
  // Corner turn when the vent is on another wall: follow the hood wall, then the vent wall.
  if (Math.abs(route[1].x - end.x) > 1 && Math.abs(route[1].z - end.z) > 1) {
    const sameAxisX = vent.wall === "back" || vent.wall === "front";
    route.push(sameAxisX ? { x: route[1].x, y: height, z: end.z } : { x: end.x, y: height, z: route[1].z });
  }
  route.push(end);
  const length = route.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - route[i].x, p.y - route[i].y, p.z - route[i].z), 0);
  return { id: `duct:${hood.id}`, points: route.map(p => ({ x: Math.round(p.x), y: Math.round(p.y), z: Math.round(p.z) })), length: Math.round(length), bends: route.length - 2 + 1, forId: hood.id };
}
