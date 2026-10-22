import { BufferAttribute, ExtrudeGeometry, Shape } from "three";
import {
  roomWalls,
  type KitchenRoom,
  type KitchenWall,
} from "@/lib/kitchenCabinets";
import { roomOutline } from "@/lib/kitchenRoomOutline";
import { ROOM_WALL_THICKNESS } from "@/lib/roomRendering";
import { kitchenWallPanels } from "@/lib/kitchenWallPanels";
import { createWallGeometry } from "./wallCsg";
import { assignWallSurfaceGroups } from "./wallSurfaceGroups";
import type { RoomDesign, RoomOpening, RoomShape, RoomWall } from "@/lib/types";
import { openingWorldTransform } from "@/lib/roomOpenings";
import {
  DEFAULT_CEILING_MATERIAL,
  DEFAULT_FLOOR_MATERIAL,
  DEFAULT_ROOM_LIGHTING,
} from "@/lib/roomDesign";
import { DEFAULT_KITCHEN_WALL_COLOR } from "@/lib/kitchenSpace";

export const KITCHEN_FLOOR_THICKNESS = 0.1;

/** One room-aware paint reflection; furniture edits do not enter its cache key. */
export function kitchenPaintDesign(
  room: KitchenRoom,
  daylight = kitchenDaylightGeometry(room).design,
): RoomDesign {
  const wallIds = {
    back: "north",
    right: "east",
    front: "south",
    left: "west",
  } as const;
  return {
    ...daylight,
    id: "kitchen-paint",
    name: "Kitchen",
    size: "40",
    wallColor: DEFAULT_KITCHEN_WALL_COLOR,
    floorColor: "#c9a37a",
    floorMaterial: DEFAULT_FLOOR_MATERIAL,
    ceilingMaterial: DEFAULT_CEILING_MATERIAL,
    wallMaterials: Object.fromEntries(
      Object.entries(wallIds).map(([side, wall]) => [
        wall,
        {
          mode: "color",
          color:
            room.wallColors?.[side as keyof typeof wallIds] ??
            DEFAULT_KITCHEN_WALL_COLOR,
        },
      ]),
    ),
    lighting: { ...DEFAULT_ROOM_LIGHTING, fixtures: [] },
    pieces: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

/** Adapt millimetre kitchen openings to the shared, room-centred daylight rig. */
export function kitchenDaylightGeometry(room: KitchenRoom) {
  const wallIds = {
    back: "north",
    right: "east",
    front: "south",
    left: "west",
  } as const;
  const windows = roomWalls(room).flatMap((wall) =>
    kitchenWallPanels(wall, room)
      .openings.filter((opening) => opening.kind === "window")
      .map((opening) => ({
        wall,
        opening,
        item: room.items!.find((item) => item.id === opening.id)!,
      })),
  );
  const design: RoomShape = {
    width: room.width / 1000,
    depth: room.depth / 1000,
    height: room.height / 1000,
    openings: windows.map(({ wall, opening, item }): RoomOpening => {
      const side = (wall.sourceWall ?? wall.id) as keyof typeof wallIds;
      const position =
        side === "back"
          ? item.x / room.width
          : side === "right"
            ? item.z / room.depth
            : side === "front"
              ? 1 - item.x / room.width
              : 1 - item.z / room.depth;
      return {
        id: opening.id,
        kind: "window",
        templateId: "window-fixed",
        wallId: wallIds[side] as RoomWall,
        position,
        width: opening.width,
        height: opening.top - opening.bottom,
        sillHeight: opening.bottom,
        hinge: "left",
        swing: "inward",
        open: false,
      };
    }),
  };
  const selected = [...windows].sort(
    (a, b) =>
      b.opening.width * (b.opening.top - b.opening.bottom) -
        a.opening.width * (a.opening.top - a.opening.bottom) ||
      a.opening.id.localeCompare(b.opening.id),
  )[0];
  if (!selected)
    return { design, offset: [0, 0] as [number, number], rotation: 0 };
  const expected = openingWorldTransform(
    design,
    design.openings!.find((opening) => opening.id === selected.opening.id)!,
  );
  const actual = kitchenWallTransform(selected.wall, roomWalls(room));
  const rotation = actual.rotation - expected.rotation;
  const x =
    actual.x +
    selected.opening.x * Math.cos(actual.rotation) -
    design.width / 2;
  const z =
    actual.z -
    selected.opening.x * Math.sin(actual.rotation) -
    design.depth / 2;
  // Insets and angled walls retain their real opening location and inward normal.
  const offset: [number, number] = [
    x - expected.x * Math.cos(rotation) - expected.z * Math.sin(rotation),
    z + expected.x * Math.sin(rotation) - expected.z * Math.cos(rotation),
  ];
  return { design, offset, rotation };
}

const samePoint = (a: KitchenWall["start"], b: KitchenWall["start"]) =>
  Math.hypot(a.x - b.x, a.z - b.z) < 0.01;

/** Wall thickness grows outwards; the measured room and cabinet coordinates stay fixed. */
export function kitchenWallTransform(wall: KitchenWall, walls: KitchenWall[]) {
  const length =
    Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z) / 1000;
  const previous = walls.find(
    (candidate) => candidate !== wall && samePoint(candidate.end, wall.start),
  );
  const next = walls.find(
    (candidate) => candidate !== wall && samePoint(candidate.start, wall.end),
  );
  const extension = (a: KitchenWall, b: KitchenWall) => {
    const ax = a.end.x - a.start.x,
      az = a.end.z - a.start.z;
    const bx = b.end.x - b.start.x,
      bz = b.end.z - b.start.z;
    const turn = Math.atan2(ax * bz - az * bx, ax * bx + az * bz);
    // A short curve sample may meet a long straight wall: limiting a positive
    // extension to that sample's length leaves a visible gap at the corner.
    return Math.max(-length * 0.45, Math.tan(turn / 2) * ROOM_WALL_THICKNESS);
  };
  return {
    length,
    x: (wall.start.x + wall.end.x) / 2000,
    z: (wall.start.z + wall.end.z) / 2000,
    rotation: Math.atan2(wall.inward.x, wall.inward.z),
    ends: {
      start: previous ? extension(previous, wall) : 0,
      end: next ? extension(wall, next) : 0,
      openStart: Boolean(previous),
      openEnd: Boolean(next),
    },
  };
}

export function createKitchenWallGeometry(
  wall: KitchenWall,
  room: KitchenRoom,
  walls = roomWalls(room),
) {
  const { length, ends } = kitchenWallTransform(wall, walls);
  const { openings } = kitchenWallPanels(wall, room);
  return assignWallSurfaceGroups(
    createWallGeometry(
      length,
      room.height / 1000,
      ROOM_WALL_THICKNESS,
      openings.map((opening) => ({
        x: opening.x,
        width: opening.width,
        height: opening.top - opening.bottom,
        sillHeight: opening.bottom,
      })),
      ends,
    ),
  );
}

/** One normalised UV plane gives rectangular and custom/curved floors the same plank scale. */
export function createKitchenFloorGeometry(room: KitchenRoom) {
  const shape = new Shape();
  roomOutline(room).forEach((point, index, points) => {
    if (index === 0) shape.moveTo(point.x / 1000, -point.z / 1000);
    const next = points[(index + 1) % points.length];
    if (point.curve)
      shape.quadraticCurveTo(
        point.curve.x / 1000,
        -point.curve.z / 1000,
        next.x / 1000,
        -next.z / 1000,
      );
    else shape.lineTo(next.x / 1000, -next.z / 1000);
  });
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, {
    depth: KITCHEN_FLOOR_THICKNESS,
    bevelEnabled: false,
    curveSegments: 64,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -KITCHEN_FLOOR_THICKNESS, 0);
  const positions = geometry.getAttribute("position"),
    uv = new Float32Array(positions.count * 2);
  for (let index = 0; index < positions.count; index++) {
    uv[index * 2] = positions.getX(index) / (room.width / 1000);
    uv[index * 2 + 1] = positions.getZ(index) / (room.depth / 1000);
  }
  geometry.setAttribute("uv", new BufferAttribute(uv, 2));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
