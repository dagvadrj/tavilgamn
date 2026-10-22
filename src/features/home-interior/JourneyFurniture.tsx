"use client";
import { useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import {
  acquireModel,
  cloneModel,
  disposeModelClone,
  type LoadedModel,
} from "@/three/modelLoader";
import type { Product } from "@/lib/types";
import type { RoomMaterials } from "./roomMaterials";

export function InteriorModelAsset({
  url,
  size,
  children,
  onStatus,
}: {
  url?: string;
  size: readonly [number, number, number];
  children?: React.ReactNode;
  onStatus?: (status: string) => void;
}) {
  const { gl, invalidate } = useThree();
  const [asset, setAsset] = useState<{
    url: string;
    model: LoadedModel;
    release: () => void;
  } | null>(null);
  useEffect(() => {
    if (!url) {
      setAsset(null);
      onStatus?.("preview");
      return;
    }
    let cancelled = false,
      transferred = false;
    const lease = acquireModel(gl, url);
    onStatus?.("loading");
    void lease.promise
      .then((model) => {
        if (cancelled) return;
        const owned = cloneModel(model);
        transferred = true;
        setAsset({ url, model: owned, release: lease.release });
        onStatus?.("ready");
        gl.shadowMap.needsUpdate = true;
        invalidate();
      })
      .catch(() => {
        if (!cancelled) onStatus?.("error");
      });
    return () => {
      cancelled = true;
      if (!transferred) lease.release();
    };
  }, [url, gl, invalidate, onStatus]);
  useEffect(
    () => () => {
      if (asset) {
        disposeModelClone(asset.model);
        asset.release();
      }
    },
    [asset],
  );
  const placement = useMemo(() => {
    if (!asset) return null;
    const bounds = asset.model.bounds,
      dimensions = bounds.getSize(new THREE.Vector3()),
      center = bounds.getCenter(new THREE.Vector3());
    const scale = Math.min(
      size[0] / dimensions.x,
      size[1] / dimensions.y,
      size[2] / dimensions.z,
    );
    return {
      scale,
      position: [
        -center.x * scale,
        -bounds.min.y * scale,
        -center.z * scale,
      ] as [number, number, number],
    };
  }, [asset, size]);
  if (!url || !asset || !placement) return children;
  // Keep the previous model through a replacement; never blank the room.
  return (
    <group dispose={null}>
      <primitive object={asset.model.scene} {...placement} />
    </group>
  );
}

export function FurnitureProduct({
  product,
  size,
  children,
  onStatus,
}: {
  product?: Product;
  size: readonly [number, number, number];
  children: React.ReactNode;
  onStatus?: (status: string) => void;
}) {
  const model = product?.model;
  return (
    <InteriorModelAsset
      url={model ? `/api/models/files/${model.id}/${model.file}` : undefined}
      size={size}
      onStatus={onStatus}
    >
      {children}
    </InteriorModelAsset>
  );
}

export function Upholstered({
  position,
  size,
  color = "#e4dacb",
  materials,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color?: string;
  materials: RoomMaterials;
}) {
  return (
    <RoundedBox
      args={size}
      position={position}
      radius={Math.min(0.13, size[1] * 0.3)}
      smoothness={4}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        color={color}
        roughness={0.96}
        normalMap={materials.linenNormal}
        normalScale={new THREE.Vector2(0.13, 0.13)}
        roughnessMap={materials.linenRoughness}
      />
    </RoundedBox>
  );
}

export function InteriorBed({ materials }: { materials: RoomMaterials }) {
  const duvet = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(2.13, 1.87, 64, 64);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        z = -positions.getY(i);
      // Draped sides, a folded upper seam and low-amplitude fabric folds.
      const edge = THREE.MathUtils.smoothstep(Math.abs(x), 0.88, 1.065);
      const foot = THREE.MathUtils.smoothstep(z, 0.78, 0.935);
      const folds =
        (Math.sin(x * 21 + z * 5) * 0.012 + Math.sin(z * 29 - x * 7) * 0.008) *
        (1 - edge * 0.5);
      positions.setXYZ(
        i,
        x,
        0.6 -
          Math.max(edge, foot) * 0.22 +
          folds +
          Math.exp(-((z + 0.84) ** 2) / 0.003) * 0.04,
        z + 0.22,
      );
    }
    geometry.computeVertexNormals();
    return geometry;
  }, []);
  useEffect(() => () => duvet.dispose(), [duvet]);
  return (
    <group>
      <Upholstered
        position={[0, 0.23, 0]}
        size={[2.02, 0.26, 2.24]}
        color="#b8a691"
        materials={materials}
      />
      <Upholstered
        position={[0, 0.85, -1.08]}
        size={[2.13, 1.12, 0.16]}
        color="#c9bdad"
        materials={materials}
      />
      <Upholstered
        position={[0, 0.44, 0]}
        size={[1.94, 0.24, 2.12]}
        color="#f3eee4"
        materials={materials}
      />
      <mesh geometry={duvet} castShadow receiveShadow>
        <meshStandardMaterial
          color="#f1e9da"
          roughness={1}
          side={THREE.DoubleSide}
          normalMap={materials.linenNormal}
          normalScale={new THREE.Vector2(0.1, 0.1)}
        />
      </mesh>
      {[-0.83, 0.83].flatMap((x) =>
        [-0.92, 0.92].map((z) => (
          <mesh key={`${x}:${z}`} position={[x, 0.06, z]} castShadow>
            <cylinderGeometry args={[0.035, 0.025, 0.12, 12]} />
            <meshStandardMaterial color="#765d45" roughness={0.7} />
          </mesh>
        )),
      )}
      <group position={[0, 0.56, -0.63]}>
        <InteriorModelAsset
          url="/interior/neutral-pillows.glb"
          size={[1.7, 0.5, 0.68]}
        >
          {[-0.48, 0.48].map((x) => (
            <Upholstered
              key={x}
              position={[x, 0.05, 0]}
              size={[0.77, 0.16, 0.5]}
              materials={materials}
              color="#f5f0e7"
            />
          ))}
        </InteriorModelAsset>
      </group>
    </group>
  );
}

export function InteriorWardrobe({ materials }: { materials: RoomMaterials }) {
  return (
    <group>
      <RoundedBox
        position={[0, 1.2, 0]}
        args={[2.45, 2.4, 0.64]}
        radius={0.015}
        smoothness={2}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color="#8d6c4c"
          map={materials.wood}
          roughness={0.62}
        />
      </RoundedBox>
      {[-0.815, 0, 0.815].map((x) => (
        <group key={x}>
          <RoundedBox
            position={[x, 1.23, 0.332]}
            args={[0.8, 2.31, 0.035]}
            radius={0.006}
            smoothness={2}
            castShadow
          >
            <meshStandardMaterial
              color="#987957"
              map={materials.slatWood}
              roughness={0.61}
            />
          </RoundedBox>
          <mesh position={[x + 0.31, 1.06, 0.368]} castShadow>
            <boxGeometry args={[0.012, 0.32, 0.018]} />
            <meshStandardMaterial
              color="#443a2e"
              metalness={0.75}
              roughness={0.35}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
