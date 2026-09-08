"use client";
import { useRef, useState, useEffect, useMemo } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Grid,
  Environment,
  ContactShadows,
  MapControls,
  Html,
  Line,
  Edges,
  useCursor,
} from "@react-three/drei";
import type { RoomDesign, PlacedFurniture } from "@/lib/types";
import { FurnitureMesh } from "./FurnitureMesh";
import { GLBFurnitureMesh } from "./GLBFurnitureMesh";
import { InteriorModel } from "./InteriorModel";
import { getProduct } from "@/store/catalog";
import { getDbModel } from "@/lib/modelRegistry";
import { isPlacementValid, snapToWall } from "./collision";

interface RoomCanvasProps {
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
  showDimensions = true,
  resetKey = 0,
  onEditStart,
  onEditEnd,
  customInterior,
}: RoomCanvasProps) {
  const [isDraggingPiece, setIsDraggingPiece] = useState(false);
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
              far: 100,
            }
          : {
              position: [
                design.width * 0.78,
                Math.max(design.width, design.depth) * 0.62,
                design.depth * 0.82,
              ],
              fov: 40,
              near: 0.1,
              far: 100,
            }
      }
      className="!h-full !w-full"
      onPointerMissed={() => onSelect(null)}
    >
      <CameraRig view={view} width={design.width} depth={design.depth} resetKey={resetKey} />
      <color attach="background" args={["#F1F0ED"]} />
      <hemisphereLight color="#FFFDF8" groundColor="#B7A58E" intensity={1.15} />

      <directionalLight
        castShadow
        color="#FFF8EA"
        intensity={1.8}
        position={[6, 10, 7]}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0002}
      />

      <directionalLight
        color="#DCE7F2"
        intensity={0.45}
        position={[-5, 5, -4]}
      />

      <Environment preset="apartment" />

      {customInterior ? (
        <InteriorModel
          basePath={customInterior.basePath}
          glbName={customInterior.glb}
          scale={customInterior.scale ?? 1}
          onError={customInterior.onError}
          onLoaded={customInterior.onLoaded}
        />
      ) : (
        <Room design={design} onSelect={onSelect} />
      )}

      {!customInterior && gridEnabled && (
        <FloorGrid width={design.width} depth={design.depth} />
      )}
      {!customInterior && showDimensions && <RoomDimensions width={design.width} depth={design.depth} />}

      {design.pieces.map((piece) => (
        <DraggablePiece
          key={piece.instanceId}
          piece={piece}
          allPieces={design.pieces}
          roomDims={{ width: design.width, depth: design.depth }}
          selected={selected === piece.instanceId}
          onSelect={onSelect}
          onMove={onMove}
          onDragChange={setIsDraggingPiece}
          snapEnabled={snapEnabled}
          gridEnabled={gridEnabled}
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
          target={[0, 0.7, 0]}
          enablePan
          screenSpacePanning
          enableRotate
          enableZoom
          enableDamping
          dampingFactor={0.08}
          minDistance={3}
          maxDistance={Math.max(30, Math.max(design.width, design.depth) * 8)}
          minPolarAngle={Math.PI / 7}
          maxPolarAngle={Math.PI / 2.08}
          minAzimuthAngle={0.08}
          maxAzimuthAngle={Math.PI / 2 - 0.08}
        />
      )}
      {view === "plan" && (
        <MapControls
          makeDefault
          enabled={!locked && !isDraggingPiece}
          target={[0, 0, 0]}
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
  resetKey,
}: {
  view: "plan" | "perspective";
  width: number;
  depth: number;
  resetKey: number;
}) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls);
  const size = useThree((state) => state.size);

  useEffect(() => {
    const roomSpan = Math.max(width, depth);
    const target = new THREE.Vector3();

    if (view === "plan") {
      target.set(0, 0, 0);

      camera.up.set(0, 0, -1);
      const aspect = size.width / Math.max(size.height, 1);
      const fov = (camera as THREE.PerspectiveCamera).fov || 40;
      const distance = Math.max(depth + 1.8, (width + 1.8) / aspect) / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2)));
      camera.position.set(0, distance, 0.001);
    } else {
      target.set(0, 0.7, 0);

      camera.up.set(0, 1, 0);
      const fit = Math.max(1, 0.95 / (size.width / Math.max(size.height, 1)));
      camera.position.set(width * 0.78 * fit, roomSpan * 0.62 * fit, depth * 0.82 * fit);
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
  }, [camera, controls, view, width, depth, resetKey, size.width, size.height]);

  return null;
}

function Room({
  design,
  onSelect,
}: {
  design: RoomDesign;
  onSelect: (id: string | null) => void;
}) {
  const wallHeight = 2.7;
  const wallThickness = 0.12;
  const floorThickness = 0.08;
  const baseboardHeight = 0.1;
  const baseboardDepth = 0.035;

  const floorTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;

    const context = canvas.getContext("2d");
    if (!context) return null;

    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, 512, 512);

    context.strokeStyle = "rgba(72, 52, 32, 0.16)";
    context.lineWidth = 2;

    const plankHeight = 64;

    for (let y = 0; y <= 512; y += plankHeight) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(512, y);
      context.stroke();

      const offset = (y / plankHeight) % 2 === 0 ? 128 : 384;

      for (let x = offset; x < 512; x += 256) {
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x, y + plankHeight);
        context.stroke();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(
      Math.max(design.width / 2.2, 1),
      Math.max(design.depth / 2.2, 1),
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;

    return texture;
  }, [design.width, design.depth]);

  useEffect(() => {
    return () => floorTexture?.dispose();
  }, [floorTexture]);

  const clearSelection = (event: { delta: number }) => {
    if (event.delta === 0) onSelect(null);
  };

  return (
    <group>
      {/* Floor slab */}
      <mesh
        position={[0, -floorThickness / 2, 0]}
        receiveShadow
        onPointerDown={clearSelection}
      >
        <boxGeometry args={[design.width, floorThickness, design.depth]} />
        <meshStandardMaterial
          map={floorTexture ?? undefined}
          color={design.floorColor}
          roughness={0.68}
          metalness={0}
        />
      </mesh>

      {/* Back wall */}
      <mesh
        position={[0, wallHeight / 2, -design.depth / 2 - wallThickness / 2]}
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={[design.width + wallThickness, wallHeight, wallThickness]}
        />
        <meshStandardMaterial
          color={design.wallColor}
          roughness={0.92}
          metalness={0}
        />
      </mesh>

      {/* Left wall */}
      <mesh
        position={[-design.width / 2 - wallThickness / 2, wallHeight / 2, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={[wallThickness, wallHeight, design.depth + wallThickness]}
        />
        <meshStandardMaterial
          color={design.wallColor}
          roughness={0.92}
          metalness={0}
        />
      </mesh>

      {/* Back wall baseboard */}
      <mesh
        position={[
          0,
          baseboardHeight / 2,
          -design.depth / 2 + baseboardDepth / 2,
        ]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[design.width, baseboardHeight, baseboardDepth]} />
        <meshStandardMaterial color="#F8F7F3" roughness={0.8} />
      </mesh>

      {/* Left wall baseboard */}
      <mesh
        position={[
          -design.width / 2 + baseboardDepth / 2,
          baseboardHeight / 2,
          0,
        ]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[baseboardDepth, baseboardHeight, design.depth]} />
        <meshStandardMaterial color="#F8F7F3" roughness={0.8} />
      </mesh>
    </group>
  );
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
  onEditStart,
  onEditEnd,
}: {
  piece: PlacedFurniture;
  allPieces: PlacedFurniture[];
  onDragChange: (dragging: boolean) => void;
  roomDims: { width: number; depth: number };
  selected: boolean;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, z: number) => void;
  snapEnabled: boolean;
  gridEnabled: boolean;
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

  useCursor(hovered || dragging, dragging ? "grabbing" : "grab", "default");

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

  if (!product && !dbModel) return null;

  const dims = dbModel
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
        if (!dragging) return;
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
        setDragging(false);
        onDragChange(false);
        onEditEnd?.();
        setInvalid(false);

        (event.target as Element).releasePointerCapture?.(event.pointerId);
      }}
    >
      {dbModel ? (
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
