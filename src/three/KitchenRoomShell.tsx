"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import {
  DataTexture,
  DoubleSide,
  LinearFilter,
  RGBAFormat,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
  type BufferGeometry,
  type Texture,
} from "three";
import {
  roomWalls,
  type KitchenRoom,
  type KitchenWall,
} from "@/lib/kitchenCabinets";
import { DEFAULT_FLOOR_MATERIAL } from "@/lib/roomDesign";
import { DEFAULT_KITCHEN_WALL_COLOR } from "@/lib/kitchenSpace";
import { kitchenWallPanels } from "@/lib/kitchenWallPanels";
import {
  ROOM_SKIRTING_DEPTH,
  ROOM_SKIRTING_HEIGHT,
  ROOM_WALL_THICKNESS,
} from "@/lib/roomRendering";
import { useRoomMaterial } from "./roomMaterials";
import { roomFloorFinish } from "./roomFloorFinish";
import { applyRoomCutaway } from "./roomCutaway";
import { animateToward } from "./demandAnimation";
import { RoomDaylightFill } from "./RoomDaylightFill";
import { useRoomPaintEnvironment } from "./useRoomPaintEnvironment";
import {
  createKitchenFloorGeometry,
  createKitchenWallGeometry,
  kitchenWallTransform,
  kitchenDaylightGeometry,
  kitchenPaintDesign,
  KITCHEN_FLOOR_THICKNESS,
} from "./kitchenRoomShellGeometry";

const noRaycast = () => {};

function KitchenRoomWall({
  wall,
  room,
  walls,
  interior,
  color,
  contactTexture,
  paintEnvironment,
}: {
  wall: KitchenWall;
  room: KitchenRoom;
  walls: KitchenWall[];
  interior?: boolean;
  color: string;
  contactTexture: Texture;
  paintEnvironment: Texture | null;
}) {
  const root = useRef<Group>(null);
  const wallMesh = useRef<Mesh<BufferGeometry, MeshStandardMaterial[]>>(null);
  const transform = useMemo(
    () => kitchenWallTransform(wall, walls),
    [wall, walls],
  );
  const { solids, openings } = kitchenWallPanels(wall, room);
  const height = room.height / 1000;
  // The parent keeps structural inputs stable while paint/furniture changes.
  const geometry = useMemo(
    () => createKitchenWallGeometry(wall, room, walls),
    [wall, room, walls],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  const finish = useRoomMaterial("wall-paint", transform.length, height, color);
  useFrame(({ camera, invalidate }, delta) => {
    if (!root.current || !wallMesh.current) return;
    const outside =
      (camera.position.x - transform.x) * wall.inward.x +
        (camera.position.z - transform.z) * wall.inward.z <
      -0.06;
    const animation = animateToward(
      wallMesh.current.material[0].opacity,
      !interior && outside ? 0 : 1,
      12,
      delta,
    );
    applyRoomCutaway(root.current, animation.value);
    if (animation.moving) invalidate();
    // Hidden colour passes still cast physical shadows, so orbiting cannot change daylight.
    wallMesh.current.castShadow = true;
  });
  return (
    <group
      position={[transform.x, 0, transform.z]}
      rotation={[0, transform.rotation, 0]}
    >
      <group ref={root}>
        <mesh
          ref={wallMesh}
          geometry={geometry}
          position={[0, height / 2, -ROOM_WALL_THICKNESS / 2]}
          castShadow
          receiveShadow
          raycast={noRaycast}
        >
          <meshStandardMaterial
            attach="material-0"
            {...finish}
            envMap={paintEnvironment}
          />
          <meshStandardMaterial
            attach="material-1"
            color="#e2dfd8"
            roughness={0.92}
          />
        </mesh>
        {solids
          .filter((panel) => panel.y - panel.height / 2 < 0.001)
          .map((panel, index) => (
            <RoundedBox
              key={index}
              args={[panel.width, ROOM_SKIRTING_HEIGHT, ROOM_SKIRTING_DEPTH]}
              radius={Math.min(0.004, panel.width / 4)}
              smoothness={2}
              position={[
                panel.x,
                ROOM_SKIRTING_HEIGHT / 2,
                ROOM_SKIRTING_DEPTH / 2,
              ]}
              receiveShadow
              raycast={noRaycast}
            >
              <meshStandardMaterial color="#efeee8" roughness={0.7} />
            </RoundedBox>
          ))}
        {openings.map((opening) => {
          const openingHeight = opening.top - opening.bottom;
          const frameWidth = 0.045;
          const frameDepth = ROOM_WALL_THICKNESS + 0.008;
          return (
            <group key={opening.id}>
              {[-1, 1].map((side) => (
                <mesh
                  key={side}
                  castShadow
                  receiveShadow
                  raycast={noRaycast}
                  position={[
                    opening.x + (side * (opening.width - frameWidth)) / 2,
                    (opening.bottom + opening.top) / 2,
                    -ROOM_WALL_THICKNESS / 2,
                  ]}
                >
                  <boxGeometry args={[frameWidth, openingHeight, frameDepth]} />
                  <meshStandardMaterial color="#f4f3ef" roughness={0.65} />
                </mesh>
              ))}
              {[opening.bottom, opening.top]
                .filter((y) => y > 0)
                .map((y) => (
                  <mesh
                    key={y}
                    castShadow
                    receiveShadow
                    raycast={noRaycast}
                    position={[
                      opening.x,
                      y === opening.top
                        ? y - frameWidth / 2
                        : y + frameWidth / 2,
                      -ROOM_WALL_THICKNESS / 2,
                    ]}
                  >
                    <boxGeometry
                      args={[opening.width, frameWidth, frameDepth]}
                    />
                    <meshStandardMaterial color="#f4f3ef" roughness={0.65} />
                  </mesh>
                ))}
              {opening.kind === "window" && (
                <>
                  <mesh
                    position={[
                      opening.x,
                      (opening.bottom + opening.top) / 2,
                      -ROOM_WALL_THICKNESS / 2,
                    ]}
                    raycast={noRaycast}
                  >
                    <boxGeometry
                      args={[
                        Math.max(0.01, opening.width - frameWidth * 2),
                        Math.max(0.01, openingHeight - frameWidth * 2),
                        0.008,
                      ]}
                    />
                    <meshStandardMaterial
                      color="#e1edf1"
                      transparent
                      opacity={0.16}
                      depthWrite={false}
                      roughness={0.12}
                    />
                  </mesh>
                  {opening.width >= 1 && (
                    <mesh
                      position={[
                        opening.x,
                        (opening.bottom + opening.top) / 2,
                        -ROOM_WALL_THICKNESS / 2,
                      ]}
                      castShadow
                      raycast={noRaycast}
                    >
                      <boxGeometry
                        args={[0.035, openingHeight - frameWidth * 2, 0.055]}
                      />
                      <meshStandardMaterial color="#f4f3ef" roughness={0.65} />
                    </mesh>
                  )}
                  <mesh
                    position={[
                      opening.x,
                      opening.bottom - 0.015,
                      -ROOM_WALL_THICKNESS / 2 + 0.025,
                    ]}
                    castShadow
                    receiveShadow
                    raycast={noRaycast}
                  >
                    <boxGeometry
                      args={[
                        opening.width + 0.06,
                        0.03,
                        ROOM_WALL_THICKNESS + 0.07,
                      ]}
                    />
                    <meshStandardMaterial color="#e5e3dc" roughness={0.48} />
                  </mesh>
                </>
              )}
            </group>
          );
        })}
      </group>
      {/* This tiny contact gradient remains when the camera cuts the wall away. */}
      {solids
        .filter((panel) => panel.y - panel.height / 2 < 0.001)
        .map((panel, index) => (
          <mesh
            key={`contact-${index}`}
            position={[panel.x, 0.003, 0.12]}
            rotation={[-Math.PI / 2, 0, 0]}
            raycast={noRaycast}
          >
            <planeGeometry args={[panel.width, 0.24]} />
            <meshBasicMaterial
              map={contactTexture}
              color="#594b3b"
              transparent
              opacity={0.18}
              depthWrite={false}
            />
          </mesh>
        ))}
    </group>
  );
}

export function KitchenRoomShell({
  room,
  interior,
}: {
  room: KitchenRoom;
  interior?: boolean;
}) {
  const floorGeometryKey = JSON.stringify([
    room.width,
    room.depth,
    room.outline,
  ]);
  const structureKey = JSON.stringify({ ...room, wallColors: undefined });
  const structure = useMemo(
    () => JSON.parse(structureKey) as KitchenRoom,
    [structureKey],
  );
  const ceiling = useRef<Mesh>(null);
  const contactTexture = useMemo(() => {
    const pixels = new Uint8Array(2 * 32 * 4);
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 2; x++)
        pixels[(y * 2 + x) * 4 + 3] = Math.round((y / 31) ** 2 * 255);
    const texture = new DataTexture(pixels, 2, 32, RGBAFormat);
    texture.magFilter = texture.minFilter = LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }, []);
  useEffect(() => () => contactTexture.dispose(), [contactTexture]);
  useFrame(({ camera }) => {
    if (ceiling.current)
      ceiling.current.visible = Boolean(
        interior && camera.position.y < room.height / 1000 - 0.04,
      );
  });
  const daylight = useMemo(
    () => kitchenDaylightGeometry(structure),
    [structure],
  );
  const paintColorsKey = JSON.stringify(room.wallColors ?? {});
  const paintDesign = useMemo(
    () =>
      kitchenPaintDesign(
        {
          ...structure,
          wallColors: JSON.parse(paintColorsKey) as KitchenRoom["wallColors"],
        },
        daylight.design,
      ),
    [structure, paintColorsKey, daylight.design],
  );
  const paintEnvironment = useRoomPaintEnvironment(paintDesign);
  const floor = useMemo(() => {
    const [width, depth, outline] = JSON.parse(floorGeometryKey) as [
      number,
      number,
      KitchenRoom["outline"],
    ];
    return createKitchenFloorGeometry({ width, depth, outline, height: 0 });
  }, [floorGeometryKey]);
  useEffect(() => () => floor.dispose(), [floor]);
  const finish = useRoomMaterial(
    DEFAULT_FLOOR_MATERIAL,
    room.width / 1000,
    room.depth / 1000,
    "#c9a37a",
  );
  const ceilingFinish = useRoomMaterial(
    "ceiling-white",
    room.width / 1000,
    room.depth / 1000,
    "#f3f1eb",
  );
  const walls = useMemo(() => roomWalls(structure), [structure]);
  return (
    <group name="KitchenRoomShell">
      <mesh geometry={floor} receiveShadow raycast={noRaycast}>
        <meshPhysicalMaterial
          attach="material-0"
          {...finish}
          {...roomFloorFinish(DEFAULT_FLOOR_MATERIAL, finish)}
        />
        <meshStandardMaterial
          attach="material-1"
          color="#c8c5bc"
          roughness={0.9}
        />
      </mesh>
      {/* Independent roof shadows keep sunlight entering through real apertures. */}
      <mesh
        geometry={floor}
        position={[0, room.height / 1000 + KITCHEN_FLOOR_THICKNESS, 0]}
        castShadow
        raycast={noRaycast}
        userData={{ previewRoof: true }}
      >
        <meshBasicMaterial
          colorWrite={false}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
      <mesh
        ref={ceiling}
        geometry={floor}
        position={[0, room.height / 1000 + KITCHEN_FLOOR_THICKNESS, 0]}
        visible={false}
        receiveShadow
        raycast={noRaycast}
        userData={{ previewRoof: true }}
      >
        <meshStandardMaterial {...ceilingFinish} side={DoubleSide} />
      </mesh>
      <group position={[room.width / 2000, 0, room.depth / 2000]}>
        <group
          position={[daylight.offset[0], 0, daylight.offset[1]]}
          rotation={[0, daylight.rotation, 0]}
        >
          <RoomDaylightFill design={daylight.design} daylight={1} />
        </group>
      </group>
      {walls.map((wall) => (
        <KitchenRoomWall
          key={wall.id}
          wall={wall}
          walls={walls}
          room={structure}
          interior={interior}
          contactTexture={contactTexture}
          paintEnvironment={paintEnvironment}
          color={
            room.wallColors?.[
              (wall.sourceWall ?? wall.id) as keyof NonNullable<
                KitchenRoom["wallColors"]
              >
            ] ?? DEFAULT_KITCHEN_WALL_COLOR
          }
        />
      ))}
      {(room.items ?? [])
        .filter((item) => item.kind === "column")
        .map((item) => (
          <mesh
            key={item.id}
            position={[item.x / 1000, room.height / 2000, item.z / 1000]}
            castShadow
            receiveShadow
            raycast={noRaycast}
          >
            <boxGeometry
              args={[item.width / 1000, room.height / 1000, item.depth / 1000]}
            />
            <meshStandardMaterial color="#eeede7" roughness={0.8} />
          </mesh>
        ))}
    </group>
  );
}
