"use client";
import { useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Grid,
  Environment,
  Lightformer,
  ContactShadows,
  MapControls,
  Html,
  Line,
  Edges,
  useCursor,
} from "@react-three/drei";
import type { RoomDesign, PlacedFurniture, RoomShape, RoomWall, RoomOpening } from "@/lib/types";
import { getRoomGeometry } from "@/lib/roomGeometry";
import { RoomStructure, RoomLighting } from "./RoomStructure";
import { FurnitureMesh } from "./FurnitureMesh";
import { GLBFurnitureMesh } from "./GLBFurnitureMesh";
import { InteriorModel } from "./InteriorModel";
import { getProduct } from "@/store/catalog";
import { getDbModel } from "@/lib/modelRegistry";
import { isPlacementValid, snapToWall } from "./collision";
import type { Measurement } from "@/lib/furnitureMeasurements";
import { KitchenAssemblyMesh } from "./KitchenAssemblyMesh";
import { dimsFor } from "./collision";
import { FurnitureMeasurements } from "./FurnitureMeasurements";

interface RoomCanvasProps {
  selectedWall?: RoomWall | null;
  onSelectWall?: (wall: RoomWall) => void;
  selectedOpening?: string | null;
  onSelectOpening?: (id: string | null) => void;
  onUpdateOpening?: (opening: RoomOpening) => void;
  placementTemplate?: string | null;
  onPlaceOpening?: (wall: RoomWall, position: number) => void;
  onPlacementError?: (message: string) => void;
  design: RoomDesign;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, z: number) => void;
  view: "plan" | "perspective";
  snapEnabled: boolean;
  /** When true, orbit controls are disabled so dragging furniture doesn't move camera */
  locked: boolean;
  gridEnabled?: boolean;
  showDimensions?: boolean;
  measurements?: Measurement[];
  resetKey?: number;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  /** Optional custom GLB interior to render instead of procedural room */
  customInterior?: {
    basePath: string;
    glb: string;
    scale?: number;
    onError?: (msg: string) => void;
    onLoaded?: () => void;
  } | null;
}

export function RoomCanvas({
  design,
  selected,
  onSelect,
  onMove,
  view,
  snapEnabled,
  locked,
  gridEnabled = false,
  showDimensions = false,
  measurements = [],
  resetKey = 0,
  onEditStart,
  onEditEnd,
  customInterior,
  selectedWall,
  onSelectWall,
  selectedOpening,
  onSelectOpening,
  onUpdateOpening,
  placementTemplate,
  onPlaceOpening,
  onPlacementError,
}: RoomCanvasProps) {
  const [isDraggingPiece, setIsDraggingPiece] = useState(false);
  const bounds = getRoomGeometry(design).bounds;
  const spanX = bounds.maxX - bounds.minX, spanZ = bounds.maxZ - bounds.minZ;
  const centerX = (bounds.minX + bounds.maxX) / 2, centerZ = (bounds.minZ + bounds.maxZ) / 2;
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        preserveDrawingBuffer: true,
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
      camera={
        view === "plan"
          ? {
              position: [0, 14, 0.01],
              fov: 35,
              near: 0.1,
              far: 300,
            }
          : {
              position: [
                design.width * 0.78,
                Math.max(design.width, design.depth) * 0.62,
                design.depth * 0.82,
              ],
              fov: 40,
              near: 0.1,
              far: 300,
            }
      }
      className="!h-full !w-full"
      onPointerMissed={() => { onSelect(null); onSelectOpening?.(null); }}
    >
      <CameraRig view={view} width={spanX} depth={spanZ} centerX={centerX} centerZ={centerZ} resetKey={resetKey} />
      <color attach="background" args={["#F1F0ED"]} />
      <RoomLighting design={design} />
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={1.3} color="#ffffff" scale={[8, 6, 1]} position={[0, 5, -8]} />
        <Lightformer form="rect" intensity={0.65} color="#fff1db" scale={[6, 6, 1]} position={[-6, 3, 0]} rotation={[0, Math.PI / 2, 0]} />
      </Environment>
      {customInterior ? (
        <InteriorModel
          basePath={customInterior.basePath}
          glbName={customInterior.glb}
          scale={customInterior.scale ?? 1}
          onError={customInterior.onError}
          onLoaded={customInterior.onLoaded}
        />
      ) : (
        <RoomStructure design={design} onSelect={onSelect} view={view}
          selectedWall={selectedWall} onSelectWall={onSelectWall}
          selectedOpening={selectedOpening} onSelectOpening={onSelectOpening} onUpdateOpening={onUpdateOpening}
          placementTemplate={placementTemplate} onPlaceOpening={onPlaceOpening} onPlacementError={onPlacementError}
          onDragChange={setIsDraggingPiece} onEditStart={onEditStart} onEditEnd={onEditEnd} />
      )}

      {!customInterior && gridEnabled && (
        <group position={[centerX, 0, centerZ]}><FloorGrid width={spanX} depth={spanZ} /></group>
      )}
      {!customInterior && showDimensions && !selected && <group position={[centerX, 0, centerZ]}><RoomDimensions width={spanX} depth={spanZ} /></group>}
      {showDimensions && selected && <FurnitureMeasurements measurements={measurements} view={view} />}

      {design.pieces.map((piece) => (
        <DraggablePiece
          key={piece.instanceId}
          piece={piece}
          allPieces={design.pieces}
          roomDims={design}
          selected={selected === piece.instanceId}
          onSelect={onSelect}
          onMove={onMove}
          onDragChange={setIsDraggingPiece}
          snapEnabled={snapEnabled}
          gridEnabled={gridEnabled}
          measureMode={showDimensions}
          onEditStart={onEditStart}
          onEditEnd={onEditEnd}
        />
      ))}

      {view === "perspective" && (
        <ContactShadows
          position={[0, 0.006, 0]}
          opacity={0.24}
          scale={Math.max(design.width, design.depth) * 1.15}
          blur={2.8}
          far={4}
        />
      )}
      {view === "perspective" && (
        <OrbitControls
          makeDefault
          enabled={!locked && !isDraggingPiece}
          target={[centerX, 0.7, centerZ]}
          enablePan
          screenSpacePanning
          enableRotate
          enableZoom
          enableDamping
          dampingFactor={0.08}
          minDistance={0.8}
          maxDistance={Math.max(30, Math.max(design.width, design.depth) * 8)}
          minPolarAngle={0.025}
          maxPolarAngle={Math.PI / 2 - 0.015}
        />
      )}
      {view === "plan" && (
        <MapControls
          makeDefault
          enabled={!locked && !isDraggingPiece}
          target={[centerX, 0, centerZ]}
          enableRotate={false}
          enablePan
          enableZoom
          screenSpacePanning={false}
          enableDamping
          dampingFactor={0.08}
          minDistance={4}
          maxDistance={Math.max(40, Math.max(design.width, design.depth) * 8)}
        />
      )}
    </Canvas>
  );
}
function CameraRig({
  view,
  width,
  depth,
  centerX,
  centerZ,
  resetKey,
}: {
  view: "plan" | "perspective";
  width: number;
  depth: number;
  centerX: number;
  centerZ: number;
  resetKey: number;
}) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls);
  const size = useThree((state) => state.size);

  useEffect(() => {
    const roomSpan = Math.max(width, depth);
    const target = new THREE.Vector3();

    if (view === "plan") {
      target.set(centerX, 0, centerZ);

      camera.up.set(0, 0, -1);
      const aspect = size.width / Math.max(size.height, 1);
      const fov = (camera as THREE.PerspectiveCamera).fov || 40;
      const distance = Math.max(depth + 1.8, (width + 1.8) / aspect) / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2)));
      camera.position.set(centerX, distance, centerZ + 0.001);
    } else {
      target.set(centerX, 0.7, centerZ);

      camera.up.set(0, 1, 0);
      const fit = Math.max(1, 0.95 / (size.width / Math.max(size.height, 1)));
      camera.position.set(centerX + width * 0.78 * fit, roomSpan * 0.62 * fit, centerZ + depth * 0.82 * fit);
    }

    camera.lookAt(target);
    camera.updateProjectionMatrix();

    if (
      controls &&
      "target" in controls &&
      "update" in controls
    ) {
      const orbitControls = controls as {
        target: THREE.Vector3;
        update: () => void;
      };

      orbitControls.target.copy(target);
      orbitControls.update();
    }
  }, [camera, controls, view, width, depth, centerX, centerZ, resetKey, size.width, size.height]);

  return null;
}

function FloorGrid({ width, depth }: { width: number; depth: number }) {
  return (
    <Grid
      position={[0, 0.012, 0]}
      args={[width, depth]}
      cellSize={0.25}
      cellThickness={0.35}
      cellColor="#BFC3C8"
      sectionSize={1}
      sectionThickness={1}
      sectionColor="#737981"
      fadeDistance={Math.max(width, depth) * 2}
      fadeStrength={0.7}
      infiniteGrid={false}
      followCamera={false}
    />
  );
}
function RoomDimensions({ width, depth }: { width: number; depth: number }) {
  const y = 0.035;
  const offset = 0.45;
  const tickSize = 0.12;
  const lineColor = "#535960";

  const labelClass =
    "whitespace-nowrap rounded-full border border-black/10 bg-white/95 px-2.5 py-1 text-[11px] font-medium text-[#171C24] shadow-sm";

  return (
    <group>
      {/* Width */}
      <Line
        points={[
          [-width / 2, y, depth / 2 + offset],
          [width / 2, y, depth / 2 + offset],
        ]}
        color={lineColor}
        lineWidth={1}
      />

      <Line
        points={[
          [-width / 2, y, depth / 2 + offset - tickSize],
          [-width / 2, y, depth / 2 + offset + tickSize],
        ]}
        color={lineColor}
        lineWidth={1}
      />

      <Line
        points={[
          [width / 2, y, depth / 2 + offset - tickSize],
          [width / 2, y, depth / 2 + offset + tickSize],
        ]}
        color={lineColor}
        lineWidth={1}
      />

      <Html
        position={[0, y, depth / 2 + offset]}
        center
        style={{ pointerEvents: "none" }}
      >
        <span className={labelClass}>{width.toFixed(2)} м</span>
      </Html>

      {/* Depth */}
      <Line
        points={[
          [width / 2 + offset, y, -depth / 2],
          [width / 2 + offset, y, depth / 2],
        ]}
        color={lineColor}
        lineWidth={1}
      />

      <Line
        points={[
          [width / 2 + offset - tickSize, y, -depth / 2],
          [width / 2 + offset + tickSize, y, -depth / 2],
        ]}
        color={lineColor}
        lineWidth={1}
      />

      <Line
        points={[
          [width / 2 + offset - tickSize, y, depth / 2],
          [width / 2 + offset + tickSize, y, depth / 2],
        ]}
        color={lineColor}
        lineWidth={1}
      />

      <Html
        position={[width / 2 + offset, y, 0]}
        center
        style={{ pointerEvents: "none" }}
      >
        <span
          className={labelClass}
          style={{
            display: "inline-block",
            transform: "rotate(-90deg)",
          }}
        >
          {depth.toFixed(2)} м
        </span>
      </Html>
    </group>
  );
}

function DraggablePiece({
  piece,
  allPieces,
  roomDims,
  selected,
  onSelect,
  onDragChange,
  onMove,
  snapEnabled,
  gridEnabled,
  measureMode,
  onEditStart,
  onEditEnd,
}: {
  piece: PlacedFurniture;
  allPieces: PlacedFurniture[];
  onDragChange: (dragging: boolean) => void;
  roomDims: RoomShape;
  selected: boolean;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, z: number) => void;
  snapEnabled: boolean;
  gridEnabled: boolean;
  measureMode: boolean;
  onEditStart?: () => void;
  onEditEnd?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const { camera, raycaster, gl } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const dragOffset = useRef(new THREE.Vector3());
  const product = getProduct(piece.productId);
  const dbModel = piece.modelId ? getDbModel(piece.modelId) : undefined;
  const [dragging, setDragging] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useCursor(hovered || dragging, measureMode ? "crosshair" : dragging ? "grabbing" : "grab", "default");

  useEffect(() => {
    if (!dragging) return;

    const finishDrag = () => {
      setDragging(false);
      setInvalid(false);
      onDragChange(false);
      onEditEnd?.();
    };

    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);

    return () => {
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
      onDragChange(false);
      onEditEnd?.();
    };
  }, [dragging, onDragChange, onEditEnd]);

  if (!product && !dbModel && !piece.kitchen) return null;

  const dims = piece.kitchen ? dimsFor(piece) : dbModel
    ? { w: dbModel.dimensionsW, d: dbModel.dimensionsD, h: dbModel.dimensionsH }
    : {
        w: product!.dimensions.w,
        d: product!.dimensions.d,
        h: product!.dimensions.h,
      };

  const planeY = 0;
  const intersectFloor = (clientX: number, clientY: number) => {
    const rect = gl.domElement.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
    const planeNormal = new THREE.Vector3(0, 1, 0);
    const plane = new THREE.Plane(planeNormal, -planeY);
    const point = new THREE.Vector3();
    return raycaster.ray.intersectPlane(plane, point);
  };

  return (
    <group
      ref={groupRef}
      position={[piece.x, 0, piece.z]}
      rotation={[0, piece.rotation, 0]}
      onClick={event => event.stopPropagation()}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => {
        setHovered(false);
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.stopPropagation();

        if (measureMode) { onSelect(piece.instanceId); return; }
        const point = intersectFloor(event.clientX, event.clientY);
        if (!point) return;
        onEditStart?.();

        dragOffset.current.set(piece.x - point.x, 0, piece.z - point.z);

        onSelect(piece.instanceId);
        setDragging(true);
        onDragChange(true);

        (event.target as Element).setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={(e) => {
        if (!dragging || measureMode) return;
        const p = intersectFloor(e.clientX, e.clientY);
        if (!p) return;
        let candidate: PlacedFurniture = {
          ...piece,
          x: p.x + dragOffset.current.x,
          z: p.z + dragOffset.current.z,
        };
        if (gridEnabled) candidate = { ...candidate, x: Math.round(candidate.x * 4) / 4, z: Math.round(candidate.z * 4) / 4 };
        if (snapEnabled) candidate = snapToWall(candidate, roomDims);
        const ok = isPlacementValid(candidate, allPieces, roomDims);
        setInvalid(!ok);
        if (ok) onMove(piece.instanceId, candidate.x, candidate.z);
      }}
      onPointerUp={(event) => {
        if (!dragging) return;
        setDragging(false);
        onDragChange(false);
        onEditEnd?.();
        setInvalid(false);

        (event.target as Element).releasePointerCapture?.(event.pointerId);
      }}
    >
      {piece.kitchen ? <KitchenAssemblyMesh kitchen={piece.kitchen.design} centered /> : dbModel ? (
        <GLBFurnitureMesh
          modelId={dbModel.fileModelId ?? dbModel.id}
          basePath={`/api/models/files/${dbModel.fileModelId ?? dbModel.id}/`}
          glbFile={dbModel.glbFile}
          w={dims.w}
          d={dims.d}
          h={dims.h}
          selected={selected}
        />
      ) : (
        <FurnitureMesh
          category={product!.category}
          color={piece.color}
          material={piece.material}
          w={dims.w}
          d={dims.d}
          h={dims.h}
        />
      )}
      {selected && (
        <mesh position={[0, dims.h / 2, 0]}>
          <boxGeometry args={[dims.w + 0.08, dims.h + 0.08, dims.d + 0.08]} />

          <meshBasicMaterial
            transparent
            opacity={0}
            depthWrite={false}
            colorWrite={false}
          />

          <Edges color="#0058A3" lineWidth={2} threshold={15} />
        </mesh>
      )}
      {invalid && (
        <mesh position={[0, dims.h / 2, 0]}>
          <boxGeometry args={[dims.w + 0.1, dims.h + 0.1, dims.d + 0.1]} />
          <meshBasicMaterial color="#E53935" transparent opacity={0.25} />
        </mesh>
      )}
    </group>
  );
}

