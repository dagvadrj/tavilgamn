"use client";
import { Suspense, useEffect, useMemo } from "react";
import { Environment, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { InteriorStyle } from "./homeStory";
import type { RoomMaterials } from "./roomMaterials";
import { InteriorModelAsset } from "./JourneyFurniture";

function Timber({
  position,
  size,
  materials,
  color = "#a58665",
}: {
  position: [number, number, number];
  size: [number, number, number];
  materials: RoomMaterials;
  color?: string;
}) {
  return (
    <RoundedBox
      position={position}
      args={size}
      radius={0.014}
      smoothness={2}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        color={color}
        map={materials.wood}
        roughness={0.63}
      />
    </RoundedBox>
  );
}
function Wall({
  position,
  size,
  color,
  materials,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  materials: RoomMaterials;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={0.94}
        normalMap={materials.wallNormal}
        normalScale={new THREE.Vector2(0.09, 0.09)}
      />
    </mesh>
  );
}
function Curtains({ z, materials }: { z: number; materials: RoomMaterials }) {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(2.2, 2.68, 88, 8),
      p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      p.setZ(i, Math.sin(x * 43) * 0.045 + Math.sin(x * 10) * 0.015);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  // The same curtain geometry is reused at both windows and owned by R3F.
  return (
    <group position={[-3.67, 1.46, z]} rotation={[0, Math.PI / 2, 0]}>
      {[-1.55, 1.55].map((x) => (
        <mesh
          key={x}
          geometry={geometry}
          position={[x, 0, 0]}
          scale={[0.45, 1, 1]}
          receiveShadow
        >
          <meshStandardMaterial
            color="#ece5d7"
            roughness={1}
            side={THREE.DoubleSide}
            normalMap={materials.linenNormal}
            normalScale={new THREE.Vector2(0.07, 0.07)}
          />
        </mesh>
      ))}
    </group>
  );
}
function WindowBay({
  z,
  wall,
  materials,
}: {
  z: number;
  wall: string;
  materials: RoomMaterials;
}) {
  return (
    <group>
      <Wall
        position={[-3.8, 1.45, z - 2.58]}
        size={[0.2, 2.9, 1.36]}
        color={wall}
        materials={materials}
      />
      <Wall
        position={[-3.8, 1.45, z + 2.58]}
        size={[0.2, 2.9, 1.36]}
        color={wall}
        materials={materials}
      />
      <Wall
        position={[-3.8, 2.79, z]}
        size={[0.2, 0.22, 3.8]}
        color={wall}
        materials={materials}
      />
      <Wall
        position={[-3.8, 0.08, z]}
        size={[0.2, 0.16, 3.8]}
        color={wall}
        materials={materials}
      />
      {[-1.87, 0, 1.87].map((offset) => (
        <Timber
          key={offset}
          position={[-3.74, 1.45, z + offset]}
          size={[0.08, 2.75, 0.055]}
          materials={materials}
          color="#ece8df"
        />
      ))}
      {[0.13, 2.72].map((y) => (
        <Timber
          key={y}
          position={[-3.74, y, z]}
          size={[0.08, 0.055, 3.8]}
          materials={materials}
          color="#ece8df"
        />
      ))}
      <Curtains z={z} materials={materials} />
    </group>
  );
}
function Rug({
  position,
  size,
  color,
  materials,
}: {
  position: [number, number, number];
  size: [number, number];
  color: string;
  materials: RoomMaterials;
}) {
  return (
    <RoundedBox
      position={position}
      args={[size[0], 0.045, size[1]]}
      radius={0.02}
      smoothness={2}
      receiveShadow
    >
      <meshStandardMaterial
        color={color}
        roughness={1}
        normalMap={materials.linenNormal}
        normalScale={new THREE.Vector2(0.24, 0.24)}
        roughnessMap={materials.linenRoughness}
      />
    </RoundedBox>
  );
}
function Artwork({
  position,
  materials,
}: {
  position: [number, number, number];
  materials: RoomMaterials;
}) {
  return (
    <group position={position}>
      <Timber
        position={[0, 0, -0.025]}
        size={[1.36, 1.48, 0.055]}
        materials={materials}
      />
      <mesh position={[0, 0, 0.008]}>
        <planeGeometry args={[1.28, 1.4]} />
        <meshStandardMaterial
          color="#e3dac7"
          roughness={1}
          normalMap={materials.wallNormal}
        />
      </mesh>
      <mesh position={[-0.24, -0.2, 0.013]}>
        <circleGeometry args={[0.4, 48, 0, Math.PI]} />
        <meshStandardMaterial color="#af9e85" roughness={1} />
      </mesh>
      <mesh position={[0.24, 0.13, 0.015]}>
        <planeGeometry args={[0.34, 0.9]} />
        <meshStandardMaterial color="#8b897b" roughness={1} />
      </mesh>
    </group>
  );
}
function Vase({ position }: { position: [number, number, number] }) {
  const points = useMemo(
    () => [
      new THREE.Vector2(0.09, 0),
      new THREE.Vector2(0.17, 0.08),
      new THREE.Vector2(0.16, 0.25),
      new THREE.Vector2(0.08, 0.35),
      new THREE.Vector2(0.075, 0.4),
    ],
    [],
  );
  return (
    <mesh position={position} castShadow>
      <latheGeometry args={[points, 40]} />
      <meshStandardMaterial color="#d4c5ad" roughness={0.88} />
    </mesh>
  );
}

export function ApartmentRoom({
  theme,
  materials,
}: {
  theme: InteriorStyle;
  materials: RoomMaterials;
}) {
  const sunlight = useMemo(() => {
    const target = new THREE.Object3D();
    target.position.set(0, 0, -4);
    return target;
  }, []);
  return (
    <group name="Connected apartment">
      <Suspense fallback={null}>
        <Environment
          files="/interior/daylight-1k.hdr"
          environmentIntensity={0.55}
          background
          backgroundBlurriness={0.15}
        />
      </Suspense>
      <primitive object={sunlight} />
      <color attach="background" args={["#ebe5db"]} />
      <ambientLight intensity={0.3} color="#eee5d5" />
      <hemisphereLight args={["#e3edf3", "#b89b77", 0.65]} />
      <directionalLight
        position={[-8, 6, -0.5]}
        target={sunlight}
        intensity={2.1}
        color="#fff0d2"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-near={0.5}
        shadow-camera-far={35}
        shadow-normalBias={0.025}
        shadow-bias={-0.00015}
      />
      {/* Both rooms share a continuous floor, ceiling and an actual aperture. */}
      <mesh position={[0, -0.035, -3.5]} receiveShadow>
        <boxGeometry args={[7.8, 0.07, 14.6]} />
        <meshStandardMaterial
          color={theme.floor}
          map={materials.wood}
          normalMap={materials.woodNormal}
          normalScale={new THREE.Vector2(0.22, 0.22)}
          roughnessMap={materials.woodRoughness}
          roughness={0.65}
        />
      </mesh>
      <Wall
        position={[0, 2.98, -3.5]}
        size={[7.8, 0.16, 14.6]}
        color="#f2ede4"
        materials={materials}
      />
      <Wall
        position={[3.9, 1.45, -3.5]}
        size={[0.2, 2.9, 14.6]}
        color={theme.wall}
        materials={materials}
      />
      <Wall
        position={[0, 1.45, -10.7]}
        size={[7.8, 2.9, 0.2]}
        color={theme.wall}
        materials={materials}
      />
      <Wall
        position={[-1.16, 1.45, -3.5]}
        size={[5.32, 2.9, 0.2]}
        color={theme.wall}
        materials={materials}
      />
      <Wall
        position={[3.43, 1.45, -3.5]}
        size={[0.94, 2.9, 0.2]}
        color={theme.wall}
        materials={materials}
      />
      <Wall
        position={[2.25, 2.7, -3.5]}
        size={[1.5, 0.4, 0.2]}
        color={theme.wall}
        materials={materials}
      />
      {[1.48, 3.02].map((x) => (
        <Timber
          key={x}
          position={[x, 1.27, -3.37]}
          size={[0.075, 2.54, 0.11]}
          materials={materials}
          color="#927250"
        />
      ))}
      <Timber
        position={[2.25, 2.53, -3.37]}
        size={[1.62, 0.075, 0.11]}
        materials={materials}
      />
      <WindowBay z={0.1} wall={theme.wall} materials={materials} />
      <WindowBay z={-7.1} wall={theme.wall} materials={materials} />
      <Rug
        position={[-0.65, 0.024, -0.45]}
        size={[4.45, 3.9]}
        color={theme.rug}
        materials={materials}
      />
      <Rug
        position={[-0.65, 0.024, -8]}
        size={[3.8, 3.9]}
        color="#d6cbbb"
        materials={materials}
      />
      <Artwork position={[-0.65, 1.94, -3.37]} materials={materials} />
      <group position={[-0.65, 2.15, -10.56]} scale={0.7}>
        <Artwork position={[0, 0, 0]} materials={materials} />
      </group>
      {/* Bed headboard sits against the far wall, leaving a walkable approach. */}
      <Timber
        position={[-0.65, 0.06, -9.72]}
        size={[3.9, 0.1, 0.08]}
        materials={materials}
        color="#e9dfd0"
      />
      {[-2.12, 0.82].map((x) => (
        <group key={x}>
          <Timber
            position={[x, 0.33, -10.15]}
            size={[0.55, 0.66, 0.48]}
            materials={materials}
          />
          <Vase position={[x, 0.68, -10.15]} />
          <mesh position={[x, 2.45, -10.15]}>
            <cylinderGeometry args={[0.006, 0.006, 0.8, 8]} />
            <meshStandardMaterial
              color="#72604c"
              metalness={0.6}
              roughness={0.4}
            />
          </mesh>
          <mesh position={[x, 1.99, -10.15]} castShadow>
            <sphereGeometry args={[0.13, 24, 16]} />
            <meshStandardMaterial
              color="#eee2c6"
              emissive="#f5d9a4"
              emissiveIntensity={0.7}
              roughness={0.7}
            />
          </mesh>
          <pointLight
            position={[x, 1.9, -10.15]}
            intensity={1.2}
            color="#ffe2ad"
            distance={3}
          />
        </group>
      ))}
      {/* Empty niche remains visible until the wardrobe arrives. */}
      {[-9.47, -6.73].map((z) => (
        <Wall
          key={z}
          position={[3.45, 1.26, z]}
          size={[0.75, 2.52, 0.12]}
          color={theme.wall}
          materials={materials}
        />
      ))}
      <Wall
        position={[3.45, 2.55, -8.1]}
        size={[0.75, 0.12, 2.86]}
        color={theme.wall}
        materials={materials}
      />
      <mesh position={[3.08, 2.46, -8.1]}>
        <boxGeometry args={[0.025, 0.025, 2.6]} />
        <meshBasicMaterial color="#ffe3ab" toneMapped={false} />
      </mesh>
      {/* Round solid timber table, real scanned plants and folded linen details. */}
      <mesh position={[-0.65, 0.4, 0.7]} castShadow receiveShadow>
        <cylinderGeometry args={[0.85, 0.85, 0.09, 64]} />
        <meshStandardMaterial
          color="#917153"
          map={materials.wood}
          roughness={0.58}
        />
      </mesh>
      <mesh position={[-0.65, 0.2, 0.7]} castShadow>
        <cylinderGeometry args={[0.43, 0.5, 0.35, 48]} />
        <meshStandardMaterial
          color="#826345"
          map={materials.wood}
          roughness={0.65}
        />
      </mesh>
      <Vase position={[-0.9, 0.45, 0.65]} />
      <Timber
        position={[-0.35, 0.49, 0.7]}
        size={[0.33, 0.065, 0.25]}
        materials={materials}
        color="#e4d6be"
      />
      {[
        [-3.05, 0, -2.7],
        [-2.9, 0, -10.1],
      ].map((position, i) => (
        <group key={i} position={position as [number, number, number]}>
          <InteriorModelAsset
            url="/interior/potted_plant_04.glb"
            size={[0.8, 1.2, 0.8]}
          />
        </group>
      ))}
      <mesh position={[-2.8, 1.25, -1.85]} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 2.5, 12]} />
        <meshStandardMaterial color="#6e6150" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[-2.8, 2.25, -1.85]} castShadow>
        <cylinderGeometry args={[0.2, 0.36, 0.36, 40, 1, true]} />
        <meshStandardMaterial
          color="#e8dbc6"
          side={THREE.DoubleSide}
          roughness={0.9}
        />
      </mesh>
      <mesh position={[-2.8, 0.025, -1.85]}>
        <cylinderGeometry args={[0.23, 0.23, 0.05, 40]} />
        <meshStandardMaterial color="#665845" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* Thin baseboards are part of the room, never animated with furniture. */}
      {[-3.67, 3.77].map((x) => (
        <Wall
          key={x}
          position={[x, 0.06, -3.5]}
          size={[0.045, 0.12, 14.3]}
          color="#eee8dd"
          materials={materials}
        />
      ))}
    </group>
  );
}
