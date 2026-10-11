"use client";
import { useMemo, useState } from "react";
import type { ModularKitchen } from "@/lib/kitchenCabinets";
import type { PlacedFurniture } from "@/lib/types";
import type { CameraRequest } from "@/lib/plannerCamera";
import { roomTourCamera } from "./roomCameraPlacement";
import { RoomStreetView } from "./RoomStreetView";

export function KitchenInteriorView({
  kitchen,
  request,
}: {
  kitchen: ModularKitchen;
  request?: CameraRequest;
}) {
  const x = kitchen.room.width / 2000,
    z = kitchen.room.depth / 2000;
  const room = useMemo(
    () => ({
      width: kitchen.room.width / 1000,
      depth: kitchen.room.depth / 1000,
      height: kitchen.room.height / 1000,
      pieces: [
        ...kitchen.cabinets.filter((c) => c.position.y < 1600),
        ...(kitchen.extras ?? []),
      ].map((c) => ({
        instanceId: c.id,
        productId: `kitchen-tour-${c.id}`,
        x: c.position.x / 1000 - x,
        z: c.position.z / 1000 - z,
        rotation: c.position.rotation,
        color: "#ffffff",
        material: "wood",
        details: {
          name: "Шүүгээ",
          dimensions: {
            w: c.width / 1000,
            d: c.depth / 1000,
            h: c.height / 1000,
          },
        },
      })) as PlacedFurniture[],
      columns: (kitchen.room.items ?? [])
        .filter((i) => i.kind === "column")
        .map((i) => ({
          id: i.id,
          x: (i.x - i.width / 2) / 1000,
          z: (i.z - i.depth / 2) / 1000,
          width: i.width / 1000,
          depth: i.depth / 1000,
        })),
    }),
    [kitchen, x, z],
  );
  const [pose, setPose] = useState(() =>
    roomTourCamera({
      ...room,
      interiorCamera: {
        x: 0,
        z: room.depth / 2 - 0.6,
        eyeHeight: 1.6,
        yaw: 0,
        pitch: -0.12,
        fov: 60,
      },
    }),
  );
  return (
    <RoomStreetView
      room={room}
      roomId="kitchen-interior"
      pose={pose}
      locked={false}
      request={request}
      onSave={setPose}
      originX={x}
      originZ={z}
    />
  );
}
