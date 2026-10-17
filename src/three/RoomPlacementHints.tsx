"use client";
import { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Camera, Plane, Raycaster, Vector2, Vector3 } from "three";
import type { RoomShape } from "@/lib/types";
import { getRoomGeometry } from "@/lib/roomGeometry";
import {
  furnitureWallId,
  type InitialPlacementHints,
} from "@/lib/furnitureAttachment";

export interface RoomPlacementHintSource {
  designId: string;
  roomId: string;
  read: (room: RoomShape) => InitialPlacementHints;
}

/** Read the live camera only when adding an item; no scene traversal or frame loop. */
export function cameraPlacementHints(
  camera: Camera,
  room: RoomShape,
): InitialPlacementHints {
  camera.updateMatrixWorld();
  const raycaster = new Raycaster(),
    point = new Vector3();
  raycaster.setFromCamera(new Vector2(0, 0.1), camera);
  const floorPoint = raycaster.ray.intersectPlane(
    new Plane(new Vector3(0, 1, 0), 0),
    point,
  );
  const floor = floorPoint ? { x: point.x, z: point.z } : undefined;
  const walls = getRoomGeometry(room).segments.filter((s) => !s.hole);
  const hits: NonNullable<InitialPlacementHints["walls"]> = [];
  // Screen centre first; nearby rays cover small pans and partially visible walls.
  for (const y of [0.1, 0.35, -0.15])
    for (const x of [0, -0.2, 0.2, -0.4, 0.4]) {
      raycaster.setFromCamera(new Vector2(x, y), camera);
      let nearest:
        { segmentId: string; along: number; distance: number } | undefined;
      for (const wall of walls) {
        const normal = new Vector3(wall.nx, 0, wall.nz),
          a = new Vector3(wall.a.x, 0, wall.a.z);
        // Camera-facing cutaway walls are hidden, so do not place on their outer face.
        if (normal.dot(camera.position.clone().sub(a)) <= 0.001) continue;
        if (
          !raycaster.ray.intersectPlane(
            new Plane().setFromNormalAndCoplanarPoint(normal, a),
            point,
          )
        )
          continue;
        if (point.y < 0 || point.y > (room.height ?? 2.7)) continue;
        const along =
          ((point.x - wall.a.x) * (wall.b.x - wall.a.x) +
            (point.z - wall.a.z) * (wall.b.z - wall.a.z)) /
          wall.length;
        if (along < 0 || along > wall.length) continue;
        const distance = point.distanceTo(raycaster.ray.origin);
        if (!nearest || distance < nearest.distance)
          nearest = { segmentId: furnitureWallId(wall), along, distance };
      }
      if (nearest && !hits.some((h) => h.segmentId === nearest.segmentId))
        hits.push({ segmentId: nearest.segmentId, along: nearest.along });
    }
  return { floor, walls: hits };
}

export function RoomPlacementHints({
  designId,
  roomId,
  onReady,
}: {
  designId: string;
  roomId: string;
  onReady: (source: RoomPlacementHintSource | null) => void;
}) {
  const camera = useThree((state) => state.camera);
  useLayoutEffect(() => {
    onReady({
      designId,
      roomId,
      read: (room) => cameraPlacementHints(camera, room),
    });
    return () => onReady(null);
  }, [camera, designId, roomId, onReady]);
  return null;
}
