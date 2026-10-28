"use client";
import { useEffect, useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { PremiumRoomModel } from "./PremiumRoomModel";
import type { PremiumMaterials } from "./premiumRoomMaterials";

/** Upholstered frame with a draped, folded cloth surface and scanned pillows. */
export function PremiumBed({
  m,
  color,
}: {
  m: PremiumMaterials;
  color?: string;
}) {
  const duvet = useMemo(() => {
    const g = new THREE.PlaneGeometry(3.18, 2.8, 100, 96),
      p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        z = -p.getY(i) + 0.42;
      const edge = THREE.MathUtils.smoothstep(Math.abs(x), 1.43, 1.59),
        foot = THREE.MathUtils.smoothstep(z, 1.64, 1.82);
      const fold =
        Math.sin(x * 22 + z * 8) * 0.014 +
        Math.sin(z * 30 - x * 6) * 0.009 +
        Math.sin(x * 9 + z * 4) * 0.018;
      const seam = Math.exp(-((z + 0.78) ** 2) / 0.007) * 0.055;
      p.setXYZ(i, x, 0.81 - Math.max(edge, foot) * 0.3 + fold + seam, z);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(() => () => duvet.dispose(), [duvet]);
  const textile = (base: string) => (
    <meshPhysicalMaterial
      color={base}
      map={m.fabricMap}
      normalMap={m.linenNormal}
      normalScale={new THREE.Vector2(0.18, 0.18)}
      roughnessMap={m.linenRoughness}
      roughness={1}
      sheen={0.55}
      sheenRoughness={0.9}
      sheenColor="#e6d8be"
    />
  );
  return (
    <group>
      <RoundedBox
        args={[3, 0.42, 3.5]}
        position={[0, 0.3, 0]}
        radius={0.16}
        smoothness={5}
        castShadow
        receiveShadow
      >
        {textile(color || "#d1c3aa")}
      </RoundedBox>
      <RoundedBox
        args={[3.15, 1.65, 0.26]}
        position={[0, 0.98, -1.68]}
        radius={0.12}
        smoothness={5}
        castShadow
        receiveShadow
      >
        {textile(color || "#d1c3aa")}
      </RoundedBox>
      <RoundedBox
        args={[2.86, 0.29, 3.28]}
        position={[0, 0.6, 0]}
        radius={0.12}
        smoothness={5}
        castShadow
        receiveShadow
      >
        {textile("#e7e1d7")}
      </RoundedBox>
      <mesh geometry={duvet} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#ddd6cb"
          map={m.fabricMap}
          normalMap={m.linenNormal}
          normalScale={new THREE.Vector2(0.12, 0.12)}
          roughness={1}
          side={THREE.DoubleSide}
          sheen={0.3}
        />
      </mesh>
      <group position={[0, 0.76, -1.05]}>
        <PremiumRoomModel
          url="/interior/neutral-pillows.glb"
          size={[2.5, 0.6, 0.9]}
        />
      </group>
      {[-1.25, 1.25].flatMap((x) =>
        [-1.4, 1.4].map((z) => (
          <mesh
            key={`${x}:${z}`}
            position={[x, 0.06, z]}
            material={m.wood}
            castShadow
          >
            <cylinderGeometry args={[0.06, 0.04, 0.12, 20]} />
          </mesh>
        )),
      )}
    </group>
  );
}
