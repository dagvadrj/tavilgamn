"use client";

import { useEffect, useMemo } from "react";
import { CanvasTexture, LinearFilter, SRGBColorSpace } from "three";
import { roomWalls, type KitchenRoom } from "@/lib/kitchenCabinets";

/** How far outside a wall its length label sits, in mm. */
const LABEL_OFFSET = 380;
/** Shorter wall pieces (mm) get no label. */
const MIN_LABELLED_WALL = 600;
/** Label height in metres; its width follows the text. */
const LABEL_HEIGHT = 0.16;
/** Grid cell and extent in metres: half-metre squares, a few rooms wide. */
const GRID_CELL = 0.5;
const GRID_SIZE = 24;

/** A dark pill with the text, drawn once into a texture (crisp at 2x). */
function labelTexture(text: string) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  const font = "600 44px system-ui, sans-serif";
  context.font = font;
  const height = 72;
  const width = Math.ceil(context.measureText(text).width) + 48;
  canvas.width = width;
  canvas.height = height;
  context.fillStyle = "rgba(23, 28, 36, 0.9)";
  context.beginPath();
  context.roundRect(0, 0, width, height, height / 2);
  context.fill();
  context.font = font;
  context.fillStyle = "#fff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, width / 2, height / 2 + 2);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  return { texture, aspect: width / height };
}

function WallLabel({
  text,
  x,
  z,
  visible,
}: {
  text: string;
  x: number;
  z: number;
  visible: boolean;
}) {
  const label = useMemo(() => labelTexture(text), [text]);
  useEffect(() => () => label.texture.dispose(), [label]);
  return (
    <sprite
      position={[x, LABEL_HEIGHT / 2 + 0.02, z]}
      scale={[LABEL_HEIGHT * label.aspect, LABEL_HEIGHT, 1]}
      visible={visible}
      renderOrder={10}
      raycast={() => {}}
    >
      <spriteMaterial
        map={label.texture}
        transparent
        depthTest={false}
        toneMapped={false}
      />
    </sprite>
  );
}

/**
 * Scale cues around the room: a faint half-metre grid on the ground outside
 * it, and, when dimensions are on, each wall's length on the floor beside it.
 * Drawn in the scene rather than as DOM overlays, which React warned about
 * when the scene remounts, and kept out of the kitchen export.
 */
export function KitchenRoomGuides({
  room,
  dimensions,
  night,
}: {
  room: KitchenRoom;
  dimensions: boolean;
  night: boolean;
}) {
  const walls = useMemo(() => roomWalls(room), [room]);
  return (
    <group name="KitchenRoomGuides" userData={{ exportExclude: true }}>
      <gridHelper
        args={[
          GRID_SIZE,
          GRID_SIZE / GRID_CELL,
          night ? "#3a4048" : "#cfd3d8",
          night ? "#2c3138" : "#e2e5e8",
        ]}
        position={[room.width / 2000, -0.004, room.depth / 2000]}
        raycast={() => {}}
      />
      {walls.map((wall) => {
        const length = Math.round(
          Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z),
        );
        // A curved wall arrives as many short pieces; those are not worth a label each.
        if (length < MIN_LABELLED_WALL) return null;
        const x =
          (wall.start.x + wall.end.x) / 2 - wall.inward.x * LABEL_OFFSET;
        const z =
          (wall.start.z + wall.end.z) / 2 - wall.inward.z * LABEL_OFFSET;
        return (
          <WallLabel
            key={wall.id}
            text={`${length} мм`}
            x={x / 1000}
            z={z / 1000}
            visible={dimensions}
          />
        );
      })}
    </group>
  );
}
