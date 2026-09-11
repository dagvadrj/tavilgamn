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
import type { RoomDesign, PlacedFurniture, RoomShape } from "@/lib/types";
import { getRoomGeometry, polygonArea } from "@/lib/roomGeometry";
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
      onPointerMissed={() => onSelect(null)}
    >
      <CameraRig view={view} width={spanX} depth={spanZ} centerX={centerX} centerZ={centerZ} resetKey={resetKey} />
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
        <Room design={design} onSelect={onSelect} view={view} />
      )}

      {!customInterior && gridEnabled && (
        <group position={[centerX, 0, centerZ]}><FloorGrid width={spanX} depth={spanZ} /></group>
      )}
      {!customInterior && showDimensions && <group position={[centerX, 0, centerZ]}><RoomDimensions width={spanX} depth={spanZ} /></group>}

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

function Room({
  design,
  onSelect,
  view,
}: {
  design: RoomDesign;
  onSelect: (id: string | null) => void;
  view: "plan" | "perspective";
}) {
  const wallHeight = design.height ?? 2.7;
  const wallThickness = 0.12;
  const floorThickness = 0.08;
  const baseboardHeight = 0.1;
  const baseboardDepth = 0.035;
  const geometry = getRoomGeometry(design);
  const floorShape = useMemo(() => {
    const outer = geometry.loops.find(loop => polygonArea(loop) > 0)!;
    const shape = new THREE.Shape(outer.map(point => new THREE.Vector2(point.x, point.z)));
    for (const loop of geometry.loops.filter(points => polygonArea(points) < 0)) {
      shape.holes.push(new THREE.Path(loop.map(point => new THREE.Vector2(point.x, point.z))));
    }
    return shape;
  }, [geometry]);

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
    texture.repeat.set(1 / 2.2, 1 / 2.2);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;

    return texture;
  }, []);

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
        rotation={[Math.PI / 2, 0, 0]}
        receiveShadow
        onPointerDown={clearSelection}
      >
        <extrudeGeometry args={[floorShape, { depth: floorThickness, bevelEnabled: false }]} />
        <meshStandardMaterial
          map={floorTexture ?? undefined}
          color={design.floorColor}
          roughness={0.68}
          metalness={0}
        />
      </mesh>

      {geometry.segments.filter(wall => !wall.hole).map((wall, index) => {
        const x = (wall.a.x + wall.b.x) / 2, z = (wall.a.z + wall.b.z) / 2;
        const onColumn = (design.columns ?? []).some(column => {
          const left = column.x - design.width / 2, top = column.z - design.depth / 2;
          return x >= left - 1e-6 && x <= left + column.width + 1e-6 && z >= top - 1e-6 && z <= top + column.depth + 1e-6;
        });
        if (onColumn) return null;
        const height = view === "plan" || wall.nx < 0 || wall.nz < 0 ? 0.16 : wallHeight;
        const rotation = -Math.atan2(wall.b.z - wall.a.z, wall.b.x - wall.a.x);
        return <group key={index}>
          <mesh position={[x - wall.nx * wallThickness / 2, height / 2, z - wall.nz * wallThickness / 2]} rotation={[0, rotation, 0]} castShadow receiveShadow>
            <boxGeometry args={[wall.length, height, wallThickness]} />
            <meshStandardMaterial color={design.wallColor} roughness={0.92} />
          </mesh>
          <mesh position={[x + wall.nx * baseboardDepth / 2, baseboardHeight / 2, z + wall.nz * baseboardDepth / 2]} rotation={[0, rotation, 0]} receiveShadow>
            <boxGeometry args={[wall.length, baseboardHeight, baseboardDepth]} />
            <meshStandardMaterial color="#F8F7F3" roughness={0.8} />
          </mesh>
        </group>;
      })}
      {(design.columns ?? []).map(column => <mesh key={column.id}
        position={[column.x + column.width / 2 - design.width / 2, (view === "plan" ? 0.2 : wallHeight) / 2, column.z + column.depth / 2 - design.depth / 2]} castShadow receiveShadow>
        <boxGeometry args={[column.width, view === "plan" ? 0.2 : wallHeight, column.depth]} />
        <meshStandardMaterial color={design.wallColor} roughness={0.92} /><Edges color="#9a9c91" />
      </mesh>)}
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
  roomDims: RoomShape;
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
