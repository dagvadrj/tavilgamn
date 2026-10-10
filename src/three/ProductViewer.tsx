"use client";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Environment } from "@react-three/drei";
import type { Material } from "@/lib/types";
import { GLBFurnitureMesh } from "./GLBFurnitureMesh";
import type { Product } from "@/lib/types";

import { stockLabel } from "@/lib/inventory";
import { useCanvasPerformance } from "./canvasPerformance";
import { CanvasDiagnostics } from "./CanvasDiagnostics";
import { ProductAppearance } from "./ProductAppearanceGroup";
import type { Group } from "three";
import { CursorNavigation } from "./CursorNavigationBinding";

interface ProductViewerProps {
  stockQuantity?: number | null;
  color: string;
  model?: Product["model"];
  material: Material;
  dimensions: { w: number; d: number; h: number };
  onReady?: () => void;
  onError?: () => void;
  onRootReady?: (root: Group | null) => void;
}

export function ProductViewer({
  stockQuantity,
  color,
  material,
  dimensions,
  model,
  onReady,
  onError,
  onRootReady,
}: ProductViewerProps) {
  const performance = useCanvasPerformance();
  return (
    <div className="relative h-full w-full">
      <p
        className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-white/95 px-3 py-2 text-xs text-[#293C32] shadow-sm"
        role="status"
      >
        {stockLabel({ stockQuantity })}
      </p>
      {model ? <Canvas
        shadows={performance.shadows}
        dpr={performance.dpr}
        camera={{ position: [3, 2, 13.5], fov: 35 }}
        className="!h-full !w-full"
        frameloop={performance.autoRotate ? "always" : "demand"}
      >
        <CanvasDiagnostics scene="product" />
        <color attach="background" args={["#EFE6D6"]} />
        <ambientLight intensity={0.55} />
        <directionalLight castShadow intensity={1.1} position={[5, 8, 5]} />
        <ProductAppearance color={color} material={material} onRootReady={onRootReady}>
          <GLBFurnitureMesh
            modelId={model.id}
            basePath={`/api/models/files/${model.id}/`}
            glbFile={model.file}
            previewGlbFile={model.previewFile}
            preservePhysicalSize={model.physicalSize}
            w={dimensions.w}
            d={dimensions.d}
            h={dimensions.h}
            onReady={onReady}
            onError={onError}
          />
        </ProductAppearance>
        {performance.contactShadows && (
          <ContactShadows
            position={[0, -0.01, 0]}
            opacity={0.35}
            scale={10}
            blur={2.5}
            far={4}
          />
        )}
        <Environment preset="apartment" />
        <OrbitControls
          enablePan
          screenSpacePanning
          zoomToCursor
          minDistance={2}
          maxDistance={8}
          autoRotate={performance.autoRotate}
          autoRotateSpeed={0.45}
          makeDefault
        />
        <CursorNavigation />
      </Canvas> : <p className="flex h-full items-center justify-center px-6 text-center text-sm" role="status">
        Энэ барааны 3D загвар хараахан бэлэн болоогүй.
      </p>}
    </div>
  );
}
