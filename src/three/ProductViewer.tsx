"use client";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Environment } from "@react-three/drei";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import * as THREE from "three";
import { useMemo } from "react";
import { FurnitureMesh } from "./FurnitureMesh";
import type { Category, Material } from "@/lib/types";
import { GLBFurnitureMesh } from "./GLBFurnitureMesh";
import type { Product } from "@/lib/types";

import { stockLabel } from "@/lib/inventory";

interface ProductViewerProps {
  stockQuantity?: number | null;
  category: Category;
  color: string;
  model?: Product["model"];
  material: Material;
  dimensions: { w: number; d: number; h: number };
}

export function ProductViewer({
  stockQuantity,
  category,
  color,
  material,
  dimensions,
  model,
}: ProductViewerProps) {
  return (
    <div className="relative h-full w-full">
    <p className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-white/95 px-3 py-2 text-xs text-[#293C32]" role="status">{stockLabel({ stockQuantity })}</p>
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [3, 2, 3.5], fov: 35 }}
      className="!h-full !w-full"
      frameloop="demand"
    >
      <color attach="background" args={["#EFE6D6"]} />
      <ambientLight intensity={0.55} />
      <directionalLight castShadow intensity={1.1} position={[5, 8, 5]} />
      {model ? (
        <GLBFurnitureMesh
          modelId={model.id}
          basePath={`/api/models/files/${model.id}/`}
          glbFile={model.file}
          w={dimensions.w}
          d={dimensions.d}
          h={dimensions.h}
        />
      ) : (
        <FurnitureMesh
          category={category}
          color={color}
          material={material}
          w={dimensions.w}
          d={dimensions.d}
          h={dimensions.h}
        />
      )}
      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.35}
        scale={10}
        blur={2.5}
        far={4}
      />
      <Environment preset="apartment" />
      <OrbitControls
        enablePan={false}
        minDistance={2}
        maxDistance={8}
        makeDefault
      />
    </Canvas>
    </div>
  );
}
