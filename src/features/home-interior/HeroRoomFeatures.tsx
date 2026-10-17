"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { RoundedBox } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { RoomMaterials } from "./roomMaterials";
import { HERO_MEDIA_WALL, HERO_ROOM, HERO_SUN, HERO_WINDOW, heroBackWallSections, heroSlatPositions } from "./heroRoomLayout";

export function HeroBackWall({ color, bump }: { color: string; bump?: THREE.Texture }) {
  return <group>{heroBackWallSections().map((part, index) => (
    <mesh key={index} position={[part.x, part.y, HERO_ROOM.backZ]} castShadow receiveShadow>
      <boxGeometry args={[part.width, part.height, .16]} />
      <meshStandardMaterial color={color} roughness={.94} bumpMap={bump} bumpScale={.008} />
    </mesh>
  ))}</group>;
}

export function HeroWindow() {
  const window = HERO_WINDOW, height = window.top - window.bottom, middle = (window.top + window.bottom) / 2;
  return <group>
    {/* Glass and exterior sky do not block the sun; the timber frame does. */}
    <mesh position={[window.x, middle, -3.5]}>
      <planeGeometry args={[window.width, height]} />
      <meshBasicMaterial color="#d3e4e9" />
    </mesh>
    <mesh position={[window.x, middle, -3.29]}>
      <planeGeometry args={[window.width, height]} />
      <meshStandardMaterial color="#e6f1f2" transparent opacity={.16} roughness={.15} metalness={.15} />
    </mesh>
    {[window.bottom, window.top].map(y => (
      <mesh key={y} position={[window.x, y, -3.18]} castShadow receiveShadow>
        <boxGeometry args={[window.width + .12, .08, .24]} />
        <meshStandardMaterial color="#f0e9df" roughness={.65} />
      </mesh>
    ))}
    {[window.x - window.width / 2, window.x, window.x + window.width / 2].map(x => (
      <mesh key={x} position={[x, middle, -3.18]} castShadow receiveShadow>
        <boxGeometry args={[.065, height, .2]} />
        <meshStandardMaterial color="#eee6db" roughness={.65} />
      </mesh>
    ))}
    <mesh position={[window.x, middle, -3.16]} castShadow receiveShadow>
      <boxGeometry args={[window.width, .055, .2]} />
      <meshStandardMaterial color="#eee6db" roughness={.65} />
    </mesh>
    <mesh position={[window.x, window.bottom - .035, -3.08]} receiveShadow>
      <boxGeometry args={[window.width + .22, .08, .42]} />
      <meshStandardMaterial color="#c4aa8c" roughness={.7} />
    </mesh>
  </group>;
}

/** One sun shadow map per room; the aperture and mullions shape its floor patch. */
export function WindowDaylight({ y }: { y: number }) {
  const target = useMemo(() => {
    const object = new THREE.Object3D(); object.position.fromArray(HERO_SUN.target); return object;
  }, []);
  return <group position={[0, y, 0]}>
    <primitive object={target} />
    <directionalLight position={HERO_SUN.position} target={target} color="#fff0d7" intensity={3.2} castShadow
      shadow-mapSize={[1024, 1024]} shadow-camera-left={-5} shadow-camera-right={5}
      shadow-camera-top={5} shadow-camera-bottom={-5} shadow-camera-near={.1} shadow-camera-far={22}
      shadow-bias={-.00015} shadow-normalBias={.012} shadow-radius={2.5} />
  </group>;
}

function UpDownSconce({ x }: { x: number }) {
  const targets = useMemo(() => [3.32, .55].map(y => {
    const object = new THREE.Object3D(); object.position.set(x, y, -3.09); return object;
  }), [x]);
  return <group>
    <RoundedBox args={[.13, .3, .14]} position={[x, 2.52, -2.96]} radius={.018} smoothness={2} castShadow>
      <meshStandardMaterial color="#29231f" metalness={.55} roughness={.4} />
    </RoundedBox>
    {[2.37, 2.67].map(y => (
      <mesh key={y} position={[x, y, -2.96]}>
        <boxGeometry args={[.09, .008, .09]} />
        <meshStandardMaterial color="#ffe4b6" emissive="#ffd090" emissiveIntensity={3} toneMapped={false} />
      </mesh>
    ))}
    {targets.map((target, index) => <group key={index}>
      <primitive object={target} />
      <spotLight position={[x, index === 0 ? 2.68 : 2.36, -2.9]} target={target}
        color="#ffd6a0" intensity={index === 0 ? 24 : 38} angle={.42} penumbra={.8} distance={3.4} decay={2} />
    </group>)}
  </group>;
}

export function TimberMediaWall({ materials }: { materials: RoomMaterials }) {
  const wall = HERO_MEDIA_WALL, positions = useMemo(heroSlatPositions, []);
  const slats = useRef<THREE.InstancedMesh>(null), invalidate = useThree(state => state.invalidate);
  useLayoutEffect(() => {
    if (!slats.current) return;
    const transform = new THREE.Object3D();
    positions.forEach((x, index) => {
      transform.position.set(x, wall.y, wall.z); transform.updateMatrix();
      slats.current!.setMatrixAt(index, transform.matrix);
    });
    slats.current.instanceMatrix.needsUpdate = true;
    slats.current.computeBoundingSphere();
    invalidate();
  }, [positions, invalidate, wall]);
  return <group>
    <mesh position={[wall.x, wall.y, -3.19]} receiveShadow>
      <boxGeometry args={[wall.width, wall.height, .035]} />
      <meshStandardMaterial color="#2d211b" roughness={.96} />
    </mesh>
    <instancedMesh ref={slats} args={[undefined, undefined, positions.length]} castShadow receiveShadow>
      <boxGeometry args={[wall.slatWidth, wall.height - .04, .075]} />
      <meshStandardMaterial color="#b58862" map={materials.slatWood} roughness={.64} />
    </instancedMesh>
    {/* Slim wall-mounted TV with an environment-lit, dark glass screen. */}
    <RoundedBox position={[wall.x, 2, -3.015]} args={[2.3, 1.32, .075]} radius={.035} smoothness={3} castShadow>
      <meshStandardMaterial color="#151719" metalness={.45} roughness={.3} />
    </RoundedBox>
    <mesh position={[wall.x, 2, -2.973]}>
      <planeGeometry args={[2.22, 1.25]} />
      <meshPhysicalMaterial color="#101a20" roughness={.19} metalness={.2} clearcoat={1} clearcoatRoughness={.12} envMapIntensity={1.1} />
    </mesh>
    <mesh position={[wall.x + 1.04, 1.37, -2.969]}>
      <sphereGeometry args={[.009, 6, 4]} />
      <meshBasicMaterial color="#e9e4d9" />
    </mesh>
    <RoundedBox position={[wall.x, .58, -2.84]} args={[3.65, .48, .47]} radius={.025} smoothness={2} castShadow receiveShadow>
      <meshStandardMaterial color="#9c7251" map={materials.slatWood} roughness={.65} />
    </RoundedBox>
    {[-.9, 0, .9].map(offset => (
      <mesh key={offset} position={[wall.x + offset, .58, -2.601]}>
        <boxGeometry args={[.008, .39, .008]} />
        <meshStandardMaterial color="#4e3626" roughness={.8} />
      </mesh>
    ))}
    <UpDownSconce x={-.52} /><UpDownSconce x={3.34} />
  </group>;
}
