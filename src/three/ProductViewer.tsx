"use client";
import { Canvas } from "@react-three/fiber";
import { useCallback, useMemo, useState } from "react";
import { Box3 } from "three";
import { Ruler, RotateCw } from "lucide-react";
import { ProductMeasurements } from "./ProductMeasurements";
import { ProductFrame } from "./ProductFrame";
import type { ProductBounds } from "@/lib/productDimensions";
import {
  OrbitControls,
  ContactShadows,
  Environment,
  Lightformer,
} from "@react-three/drei";
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
  showStockBadge?: boolean;
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
  showStockBadge = true,
  color,
  material,
  dimensions,
  model,
  onReady,
  onError,
  onRootReady,
}: ProductViewerProps) {
  const performance = useCanvasPerformance();
  const [measurements, setMeasurements] = useState(true),
    [rotate, setRotate] = useState(false);
  const [root, setRoot] = useState<Group | null>(null),
    [readyModel, setReadyModel] = useState<string | null>(null);
  const modelKey = `${model?.id ?? ""}:${model?.file ?? ""}:${dimensions.w}:${dimensions.d}:${dimensions.h}`;
  const rootReady = useCallback(
    (value: Group | null) => {
      setRoot(value);
      onRootReady?.(value);
    },
    [onRootReady],
  );
  const modelReady = useCallback(() => {
    setReadyModel(modelKey);
    onReady?.();
  }, [modelKey, onReady]);
  const bounds = useMemo<ProductBounds | null>(() => {
    if (readyModel !== modelKey || !root) return null;
    root.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(root);
    return box.isEmpty()
      ? null
      : { min: box.min.toArray(), max: box.max.toArray() };
  }, [readyModel, modelKey, root]);
  return (
    <div className="relative h-full w-full">
      {model && (
        <div
          className="absolute bottom-3 right-3 z-20 flex flex-wrap justify-end gap-2"
          role="group"
          aria-label="3D харагдацын тохиргоо"
        >
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[#242828] px-3 text-xs font-semibold text-white"
            aria-pressed={measurements}
            onClick={() => setMeasurements((value) => !value)}
          >
            <Ruler size={15} />
            Хэмжээс: {measurements ? "ON" : "OFF"}
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/95 px-3 text-xs font-semibold text-[#242828]"
            aria-pressed={rotate}
            onClick={() => setRotate((value) => !value)}
          >
            <RotateCw size={15} />
            Эргүүлэх
          </button>
        </div>
      )}
      {showStockBadge && (
        <p
          className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-white/95 px-3 py-2 text-xs text-ui-ink shadow-sm"
          role="status"
        >
          {stockLabel({ stockQuantity })}
        </p>
      )}
      {model ? (
        <Canvas
          shadows={performance.shadows}
          dpr={performance.dpr}
          camera={{ position: [3, 2, 13.5], fov: 35 }}
          className="!h-full !w-full"
          frameloop={rotate ? "always" : "demand"}
        >
          <CanvasDiagnostics scene="product" />
          <color attach="background" args={["#EFE6D6"]} />
          <ambientLight intensity={0.55} />
          <directionalLight castShadow intensity={1.1} position={[5, 8, 5]} />
          <ProductAppearance
            color={color}
            material={material}
            onRootReady={rootReady}
          >
            <GLBFurnitureMesh
              modelId={model.id}
              basePath={`/api/models/files/${model.id}/`}
              glbFile={model.file}
              preservePhysicalSize={model.physicalSize}
              w={dimensions.w}
              d={dimensions.d}
              h={dimensions.h}
              onReady={modelReady}
              onError={onError}
            />
          </ProductAppearance>
          {measurements && bounds && <ProductMeasurements bounds={bounds} />}
          {performance.contactShadows && (
            <ContactShadows
              position={[0, -0.01, 0]}
              opacity={0.35}
              scale={10}
              blur={2.5}
              far={4}
            />
          )}
          <Environment resolution={128}>
            <Lightformer
              form="rect"
              intensity={2.5}
              color="#ffffff"
              position={[0, 4, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              scale={[6, 6, 1]}
            />
            <Lightformer
              form="rect"
              intensity={1.8}
              color="#f7eee2"
              position={[-4, 2, 3]}
              target={[0, 0.7, 0]}
              scale={[3, 4, 1]}
            />
            <Lightformer
              form="rect"
              intensity={1.4}
              color="#edf4ff"
              position={[4, 2, -2]}
              target={[0, 0.7, 0]}
              scale={[3, 4, 1]}
            />
          </Environment>
          <OrbitControls
            enablePan
            screenSpacePanning
            zoomToCursor
            minDistance={2}
            maxDistance={8}
            autoRotate={rotate}
            autoRotateSpeed={0.45}
            makeDefault
          />
          <CursorNavigation />
          <ProductFrame bounds={bounds} />
        </Canvas>
      ) : (
        <p
          className="flex h-full items-center justify-center px-6 text-center text-sm"
          role="status"
        >
          Энэ барааны 3D загвар хараахан бэлэн болоогүй.
        </p>
      )}
    </div>
  );
}
