"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { RoundedBox } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { RoomMaterials } from "./roomMaterials";
import {
  HERO_MEDIA_WALL,
  HERO_ROOM,
  HERO_SUN,
  HERO_WINDOW,
  heroBackWallSections,
  heroSlatPositions,
} from "./heroRoomLayout";

export function HeroBackWall({
  color,
  bump,
}: {
  color: string;
  bump?: THREE.Texture;
}) {
  return (
    <group>
      {heroBackWallSections().map((part, index) => (
        <mesh
          key={index}
          position={[part.x, part.y, HERO_ROOM.backZ]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[part.width, part.height, 0.16]} />
          <meshStandardMaterial
            color={color}
            roughness={0.75}
            bumpMap={bump}
            bumpScale={0.008}
          />
        </mesh>
      ))}
    </group>
  );
}

export function HeroWindow() {
  const window = HERO_WINDOW,
    height = window.top - window.bottom,
    middle = (window.top + window.bottom) / 2;
  return (
    <group>
      {/* Glass and exterior sky do not block the sun; the timber frame does. */}
      <mesh position={[window.x, middle, -3.5]}>
        <planeGeometry args={[window.width, height]} />
        <meshBasicMaterial color="#d3e4e9" />
      </mesh>
      <mesh position={[window.x, middle, -3.29]}>
        <planeGeometry args={[window.width, height]} />
        <meshStandardMaterial
          color="#e6f1f2"
          transparent
          opacity={0.16}
          roughness={0.15}
          metalness={0.15}
        />
      </mesh>
      {[window.bottom, window.top].map((y) => (
        <mesh key={y} position={[window.x, y, -3.18]} castShadow receiveShadow>
          <boxGeometry args={[window.width + 0.12, 0.08, 0.24]} />
          <meshStandardMaterial color="#f0e9df" roughness={0.65} />
        </mesh>
      ))}
      {[window.x - window.width / 2, window.x, window.x + window.width / 2].map(
        (x) => (
          <mesh key={x} position={[x, middle, -3.18]} castShadow receiveShadow>
            <boxGeometry args={[0.065, height, 0.2]} />
            <meshStandardMaterial color="#eee6db" roughness={0.65} />
          </mesh>
        ),
      )}
      <mesh position={[window.x, middle, -3.16]} castShadow receiveShadow>
        <boxGeometry args={[window.width, 0.055, 0.2]} />
        <meshStandardMaterial color="#eee6db" roughness={0.65} />
      </mesh>
      <mesh position={[window.x, window.bottom - 0.035, -3.08]} receiveShadow>
        <boxGeometry args={[window.width + 0.22, 0.08, 0.42]} />
        <meshStandardMaterial color="#c4aa8c" roughness={0.7} />
      </mesh>
    </group>
  );
}

/** One sun shadow map per room; the aperture and mullions shape its floor patch. */
export function WindowDaylight({ y }: { y: number }) {
  const target = useMemo(() => {
    const object = new THREE.Object3D();
    object.position.fromArray(HERO_SUN.target);
    return object;
  }, []);
  return (
    <group position={[0, y, 0]}>
      <primitive object={target} />
      <directionalLight
        position={HERO_SUN.position}
        target={target}
        color="#2B2B2B"
        intensity={3.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-camera-near={0.1}
        shadow-camera-far={22}
        shadow-bias={-0.00015}
        shadow-normalBias={0.012}
        shadow-radius={2.5}
      />
    </group>
  );
}

function UpDownSconce({ x }: { x: number }) {
  const targets = useMemo(
    () =>
      [3.32, 0.55].map((y) => {
        const object = new THREE.Object3D();
        object.position.set(x, y, -3.09);
        return object;
      }),
    [x],
  );
  return (
    <group>
      <RoundedBox
        args={[0.13, 0.3, 0.14]}
        position={[x, 2.52, -2.96]}
        radius={0.018}
        smoothness={2}
        castShadow
      >
        <meshStandardMaterial
          color="#29231f"
          metalness={0.55}
          roughness={0.4}
        />
      </RoundedBox>
      {[2.37, 2.67].map((y) => (
        <mesh key={y} position={[x, y, -2.96]}>
          <boxGeometry args={[0.09, 0.008, 0.09]} />
          <meshStandardMaterial
            color="#ffe4b6"
            emissive="#ffd090"
            emissiveIntensity={3}
            toneMapped={false}
          />
        </mesh>
      ))}
      {targets.map((target, index) => (
        <group key={index}>
          <primitive object={target} />
          <spotLight
            position={[x, index === 0 ? 2.68 : 2.36, -2.9]}
            target={target}
            color="#ffd6a0"
            intensity={index === 0 ? 24 : 38}
            angle={0.42}
            penumbra={0.8}
            distance={3.4}
            decay={2}
          />
        </group>
      ))}
    </group>
  );
}

export function TimberMediaWall({ materials }: { materials: RoomMaterials }) {
  const wall = HERO_MEDIA_WALL,
    positions = useMemo(heroSlatPositions, []);
  const slats = useRef<THREE.InstancedMesh>(null),
    invalidate = useThree((state) => state.invalidate);
  useLayoutEffect(() => {
    if (!slats.current) return;
    const transform = new THREE.Object3D();
    positions.forEach((x, index) => {
      transform.position.set(x, wall.y, wall.z);
      transform.updateMatrix();
      slats.current!.setMatrixAt(index, transform.matrix);
    });
    slats.current.instanceMatrix.needsUpdate = true;
    slats.current.computeBoundingSphere();
    invalidate();
  }, [positions, invalidate, wall]);
  return (
    <group>
      <mesh position={[wall.x, wall.y, -3.19]} receiveShadow>
        <boxGeometry args={[wall.width, wall.height, 0.035]} />
        <meshStandardMaterial color="#2d211b" roughness={0.96} />
      </mesh>
      <instancedMesh
        ref={slats}
        args={[undefined, undefined, positions.length]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[wall.slatWidth, wall.height - 0.04, 0.075]} />
        <meshStandardMaterial
          color="#b58862"
          map={materials.slatWood}
          roughness={0.64}
        />
      </instancedMesh>
      {/* Slim wall-mounted TV with an environment-lit, dark glass screen. */}
      <RoundedBox
        position={[wall.x, 2, -3.015]}
        args={[2.3, 1.32, 0.075]}
        radius={0.035}
        smoothness={3}
        castShadow
      >
        <meshStandardMaterial
          color="#151719"
          metalness={0.45}
          roughness={0.3}
        />
      </RoundedBox>
      <mesh position={[wall.x, 2, -2.973]}>
        <planeGeometry args={[2.22, 1.25]} />
        <meshPhysicalMaterial
          color="#101a20"
          roughness={0.19}
          metalness={0.2}
          clearcoat={1}
          clearcoatRoughness={0.12}
          envMapIntensity={1.1}
        />
      </mesh>
      <mesh position={[wall.x + 1.04, 1.37, -2.969]}>
        <sphereGeometry args={[0.009, 6, 4]} />
        <meshBasicMaterial color="#e9e4d9" />
      </mesh>
      <RoundedBox
        position={[wall.x, 0.58, -2.84]}
        args={[3.65, 0.48, 0.47]}
        radius={0.025}
        smoothness={2}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color="#9c7251"
          map={materials.slatWood}
          roughness={0.65}
        />
      </RoundedBox>
      {[-0.9, 0, 0.9].map((offset) => (
        <mesh key={offset} position={[wall.x + offset, 0.58, -2.601]}>
          <boxGeometry args={[0.008, 0.39, 0.008]} />
          <meshStandardMaterial color="#4e3626" roughness={0.8} />
        </mesh>
      ))}
      <UpDownSconce x={-0.52} />
      <UpDownSconce x={3.34} />
    </group>
  );
}
