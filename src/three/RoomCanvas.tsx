"use client";
import { useRef, useState, useEffect, useMemo } from "react";
import * as THREE from "three";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Grid,
  Environment,
  Lightformer,
  ContactShadows,
  MapControls,
  Html,
  Edges,
  useCursor,
} from "@react-three/drei";
import type {
  RoomDesign,
  PlacedFurniture,
  RoomShape,
  RoomWall,
  RoomOpening,
} from "@/lib/types";
import { connectionGeometry, layoutBounds, roomPosition } from "@/lib/roomLayout";
import { roomLabelOpacity, solarLighting } from "@/lib/roomLighting";
import { animateToward } from "./demandAnimation";
import { getRoomGeometry } from "@/lib/roomGeometry";
import { RoomStructure, RoomLighting } from "./RoomStructure";
import { FurnitureMesh } from "./FurnitureMesh";
import { GLBFurnitureMesh } from "./GLBFurnitureMesh";
import { InteriorModel } from "./InteriorModel";
import { getProduct } from "@/store/catalog";
import { getDbModel } from "@/lib/modelRegistry";
import { roomPlacementContext } from "./roomPlacement";
import { isPlacementValid, snapToWall } from "./collision";
import type { Measurement } from "@/lib/furnitureMeasurements";
import { KitchenAssemblyMesh } from "./KitchenAssemblyMesh";
import { dimsFor } from "./collision";
import { RoomDimensions } from "./RoomDimensions";
import { FurnitureMeasurements } from "./FurnitureMeasurements";
import {
  normalizeKitchenMaterials,
  type KitchenMaterialDefinition,
} from "@/lib/kitchenMaterials";
import { useCanvasPerformance } from "./canvasPerformance";
import { CanvasDiagnostics } from "./CanvasDiagnostics";
import { CameraMotionPreview } from "./CameraMotionPreview";
import { RoomCameraRig } from "./RoomCameraRig";
import { CameraNavigation } from "./CameraNavigation";
import type { CameraRequest } from "@/lib/plannerCamera";
import { CursorNavigation } from "./CursorNavigationBinding";
import { SCENE_NAVIGATION_START, isSceneNavigationGesture } from "./sceneNavigation";

// The camera and WebGL renderer survive room selection; the rig owns their pose.
const ROOM_CAMERA = { position: [6, 5, 6] as [number, number, number], fov: 40, near: .1, far: 300 };

interface RoomCanvasProps {
  onSelectRoom?: (id: string) => void;
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
  cameraRequest?: CameraRequest;
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
  onSelectRoom,
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
  cameraRequest,
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
  const placement = useMemo(() => roomPlacementContext(design), [design]);
  const performance = useCanvasPerformance();
  const [isDraggingPiece, setIsDraggingPiece] = useState(false);
  const [kitchenMaterials, setKitchenMaterials] = useState<
    Record<string, KitchenMaterialDefinition>
  >({});
  const rooms = design.rooms ?? [];
  const activeRoom = rooms.find(room => room.id === design.activeRoomId);
  const origin = activeRoom ? roomPosition(activeRoom) : { x: 0, z: 0 };
  const solar = solarLighting(design.lighting);
  const hasKitchen = (rooms.length ? rooms.flatMap(room => room.pieces) : design.pieces).some((piece) => piece.kitchen);
  useEffect(() => {
    if (!hasKitchen) return;
    const controller = new AbortController();
    fetch("/api/kitchen-modules", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) =>
        response.ok ? response.json() : Promise.reject(new Error("catalog")),
      )
      .then((result) =>
        setKitchenMaterials(
          Object.fromEntries(
            normalizeKitchenMaterials(result.materials).map((material) => [
              material.id,
              material,
            ]),
          ),
        ),
      )
      .catch((error) => {
        if (error?.name !== "AbortError") setKitchenMaterials({});
      });
    return () => controller.abort();
  }, [hasKitchen]);
  const worldBounds = !customInterior && rooms.length ? layoutBounds(rooms) : getRoomGeometry(design).bounds;
  const bounds = !customInterior && rooms.length ? {minX:worldBounds.minX-origin.x,maxX:worldBounds.maxX-origin.x,minZ:worldBounds.minZ-origin.z,maxZ:worldBounds.maxZ-origin.z} : worldBounds;
  const spanX = bounds.maxX - bounds.minX,
    spanZ = bounds.maxZ - bounds.minZ;
  const centerX = (bounds.minX + bounds.maxX) / 2,
    centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const roomHeight = Math.max(design.height ?? 2.7, ...rooms.map(room => room.height ?? 2.7));
  return (
    <Canvas
      shadows={performance.shadows}
      dpr={performance.dpr}
      frameloop="demand"
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        preserveDrawingBuffer: true,
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
      camera={ROOM_CAMERA}
      className="!h-full !w-full"
      onPointerMissed={() => {
        onSelect(null);
        onSelectOpening?.(null);
      }}
    >
      <CameraMotionPreview interactionActive={isDraggingPiece}>
      <CanvasDiagnostics scene="room" />
      <RoomCameraRig
        view={view}
        width={spanX}
        depth={spanZ}
        height={roomHeight}
        centerX={centerX}
        centerZ={centerZ}
        resetKey={resetKey}
        originX={origin.x}
        originZ={origin.z}
      />
      <color attach="background" args={[solar.night ? "#252c38" : "#F1F0ED"]} />
      <RoomLighting fixtureShadows={performance.shadows && rooms.length <= 6} design={{...design, lighting: customInterior ? design.lighting : {...design.lighting!, fixtures: []}}} extent={Math.max(spanX, spanZ) * .8 + 4} centre={[centerX,centerZ]} />
      <Environment resolution={128} frames={1} environmentIntensity={.08 + .92 * solar.daylight}>
        {/* Neutral room bounce surrounds the model, including the areas between softboxes. */}
        <color attach="background" args={["#bcbcbc"]}/>
        <Lightformer
          form="rect"
          intensity={.8}
          color="#ffffff"
          scale={[8, 6, 1]}
          position={[0, 5, -8]}
        />
        <Lightformer
          form="rect"
          intensity={.35}
          color="#ffffff"
          scale={[6, 6, 1]}
          position={[-6, 3, 0]}
          rotation={[0, Math.PI / 2, 0]}
        />
        <Lightformer form="rect" intensity={.65} color="#ffffff" scale={[12, 12, 1]} position={[0, 10, 0]} rotation={[Math.PI / 2, 0, 0]}/>
      </Environment>
      {!customInterior && view === "perspective" && <mesh position={[centerX, -.091, centerZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow raycast={() => {}}>
        <planeGeometry args={[Math.max(60, spanX * 4), Math.max(60, spanZ * 4)]}/><meshStandardMaterial color={solar.night ? "#252c38" : "#eeece7"} roughness={1}/>
      </mesh>}
      {customInterior ? (
        <InteriorModel
          basePath={customInterior.basePath}
          glbName={customInterior.glb}
          scale={customInterior.scale ?? 1}
          onError={customInterior.onError}
          onLoaded={customInterior.onLoaded}
        />
      ) : (
        rooms.length ? <>{rooms.map(room => {
          const active = room.id === design.activeRoomId, p = roomPosition(room);
          const shared = connectionGeometry(room, rooms, design.connections ?? []);
          const roomDesign = {...design, ...room, id: design.id, roomName: room.name, roomType: room.type, openings: shared.visibleOpenings};
          return <group key={room.id} position={[p.x-origin.x,0,p.z-origin.z]}>
            <RoomStructure design={roomDesign} view={view} sharedCuts={shared.cuts} sharedBoundaries={shared.boundaries} connectionOpenings={shared.openings} readOnly={!active}
              onSelect={active ? onSelect : () => onSelectRoom?.(room.id)} selectedWall={active ? selectedWall : null}
              onSelectWall={active ? onSelectWall : undefined} selectedOpening={active ? selectedOpening : null}
              onSelectOpening={active ? onSelectOpening : () => onSelectRoom?.(room.id)} onUpdateOpening={active ? onUpdateOpening : undefined}
              placementTemplate={active ? placementTemplate : null} onPlaceOpening={active ? onPlaceOpening : undefined}
              onPlacementError={onPlacementError} onDragChange={setIsDraggingPiece} onEditStart={onEditStart} onEditEnd={onEditEnd} />
            <RoomLighting design={roomDesign} includeSun={false} fixtureShadows={performance.shadows && rooms.length <= 6} />
            {!active && room.pieces.map(piece => <DraggablePiece key={piece.instanceId} piece={piece} allPieces={room.pieces}
              roomDims={room} selected={false} onSelect={() => onSelectRoom?.(room.id)} onMove={() => {}}
              onDragChange={setIsDraggingPiece} snapEnabled={false} gridEnabled={false} measureMode={true} kitchenMaterials={kitchenMaterials} />)}
            <RoomCaption name={room.name} area={getRoomGeometry(room).area} span={Math.max(room.width,room.depth)} active={active} onSelect={() => onSelectRoom?.(room.id)} />
          </group>;
        })}</> : <>
          <RoomStructure design={design} onSelect={onSelect} view={view} selectedWall={selectedWall} onSelectWall={onSelectWall}
            selectedOpening={selectedOpening} onSelectOpening={onSelectOpening} onUpdateOpening={onUpdateOpening}
            placementTemplate={placementTemplate} onPlaceOpening={onPlaceOpening} onPlacementError={onPlacementError}
            onDragChange={setIsDraggingPiece} onEditStart={onEditStart} onEditEnd={onEditEnd} />
          <RoomLighting design={design} includeSun={false} fixtureShadows={performance.shadows} />
        </>
      )}

      {!customInterior && gridEnabled && (
        <group position={[centerX, 0, centerZ]}>
          <FloorGrid width={spanX} depth={spanZ} />
        </group>
      )}
      {!customInterior && showDimensions && !selected && (
        rooms.length ? rooms.map(room=>{
          const p=roomPosition(room);
          return <group key={"dimensions-"+room.id} position={[p.x-origin.x,0,p.z-origin.z]}>
            <RoomDimensions room={room} neighbours={rooms} name={room.name} active={room.id===design.activeRoomId}/>
          </group>;
        }) : <RoomDimensions room={design} name={design.roomName}/>
      )}
      {showDimensions && selected && (
        <FurnitureMeasurements measurements={measurements} view={view} />
      )}

      {design.pieces.map((piece) => (
        <DraggablePiece
          key={piece.instanceId}
          piece={piece}
          allPieces={customInterior ? design.pieces : placement.pieces}
          roomDims={customInterior ? design : placement.room}
          selected={selected === piece.instanceId}
          onSelect={onSelect}
          onMove={onMove}
          onDragChange={setIsDraggingPiece}
          snapEnabled={snapEnabled}
          gridEnabled={gridEnabled}
          measureMode={showDimensions}
          onEditStart={onEditStart}
          onEditEnd={onEditEnd}
          kitchenMaterials={kitchenMaterials}
        />
      ))}

      {view === "perspective" && performance.contactShadows && (
        <ContactShadows
          position={[centerX, -.082, centerZ]}
          opacity={.2}
          scale={Math.max(spanX, spanZ) * 1.15}
          blur={3.5}
          far={2.8}
          color="#766c5d"
        />
      )}
      {view === "perspective" && (
        <OrbitControls
          makeDefault
          enabled={!locked && !isDraggingPiece}
          enablePan
          screenSpacePanning
          enableRotate
          enableZoom
          zoomToCursor
          enableDamping
          dampingFactor={0.08}
          minDistance={0.8}
          maxDistance={Math.max(100, Math.max(spanX, spanZ) * 50)}
          minPolarAngle={0.025}
          maxPolarAngle={Math.PI / 2 - 0.015}
        />
      )}
      {view === "plan" && (
        <MapControls
          makeDefault
          enabled={!locked && !isDraggingPiece}
          enableRotate={false}
          enablePan
          enableZoom
          zoomToCursor
          screenSpacePanning
          enableDamping
          dampingFactor={0.08}
          minDistance={4}
          maxDistance={Math.max(40, Math.max(design.width, design.depth) * 8)}
        />
      )}
      <CameraNavigation request={cameraRequest} plan={view === "plan"}
        bounds={{ width: spanX, depth: spanZ, height: roomHeight, centerX, centerZ }}/>
      <CursorNavigation enabled={!locked} plan={view === "plan"} />
      </CameraMotionPreview>
    </Canvas>
  );
}
function RoomCaption({ name, area, span, active, onSelect }: { name: string; area: number; span: number; active: boolean; onSelect: () => void }) {
  const anchor = useRef<THREE.Group>(null), button = useRef<HTMLButtonElement>(null);
  const world = useMemo(() => new THREE.Vector3(), []);
  useFrame(({camera,invalidate},delta) => {
    if (!anchor.current || !button.current) return;
    anchor.current.getWorldPosition(world);
    const target = roomLabelOpacity(camera.position.distanceTo(world), span);
    const current = Number(button.current.style.opacity || 1);
    const animation = animateToward(current,target,9,delta);
    button.current.style.opacity=String(animation.value);
    button.current.style.visibility=animation.value<.015?"hidden":"visible";
    button.current.style.pointerEvents=animation.value<.1?"none":"auto";
    if(animation.moving)invalidate();
  });
  return <group ref={anchor} position={[0,.35,0]}><Html center zIndexRange={[12,0]}>
    <button ref={button} type="button" className="room-world-label" aria-pressed={active} onClick={onSelect}><strong>{name}</strong><small>{area.toFixed(1)} м²</small></button>
  </Html></group>;
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
  kitchenMaterials,
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
  kitchenMaterials: Record<string, KitchenMaterialDefinition>;
}) {
  const [hovered, setHovered] = useState(false);
  const { camera, raycaster, gl } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const dragOffset = useRef(new THREE.Vector3());
  const dragCapture = useRef<{ pointerId: number; target: Element } | null>(null);
  const product = getProduct(piece.productId);
  const dbModel = piece.modelId ? getDbModel(piece.modelId) : undefined;
  const [dragging, setDragging] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useCursor(
    hovered || dragging,
    measureMode ? "crosshair" : dragging ? "grabbing" : "grab",
    "default",
  );

  useEffect(() => {
    if (!dragging) return;

    const finishDrag = () => {
      const capture = dragCapture.current;
      dragCapture.current = null;
      try { capture?.target.releasePointerCapture?.(capture.pointerId); } catch { /* Capture may already be released. */ }
      setDragging(false);
      setInvalid(false);
      onDragChange(false);
      onEditEnd?.();
    };

    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);
    window.addEventListener("blur", finishDrag);
    gl.domElement.addEventListener(SCENE_NAVIGATION_START, finishDrag);

    return () => {
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
      window.removeEventListener("blur", finishDrag);
      gl.domElement.removeEventListener(SCENE_NAVIGATION_START, finishDrag);
      onDragChange(false);
      onEditEnd?.();
    };
  }, [dragging, onDragChange, onEditEnd, gl]);

  if (!product && !dbModel && !piece.kitchen) return null;

  const dims = piece.kitchen
    ? dimsFor(piece)
    : dbModel
      ? {
          w: dbModel.dimensionsW,
          d: dbModel.dimensionsD,
          h: dbModel.dimensionsH,
        }
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
      onClick={(event) => event.stopPropagation()}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => {
        setHovered(false);
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        if (event.pointerType === "touch" && isSceneNavigationGesture(gl.domElement)) return;
        event.stopPropagation();

        if (measureMode) {
          onSelect(piece.instanceId);
          return;
        }
        const point = intersectFloor(event.clientX, event.clientY);
        if (!point) return;
        onEditStart?.();

        dragOffset.current.set(piece.x - point.x, 0, piece.z - point.z);

        onSelect(piece.instanceId);
        setDragging(true);
        onDragChange(true);

        (event.target as Element).setPointerCapture?.(event.pointerId);
        dragCapture.current = { pointerId: event.pointerId, target: event.target as Element };
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
        if (gridEnabled)
          candidate = {
            ...candidate,
            x: Math.round(candidate.x * 4) / 4,
            z: Math.round(candidate.z * 4) / 4,
          };
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
      {piece.kitchen ? (
        <KitchenAssemblyMesh
          kitchen={piece.kitchen.design}
          centered
          materialDefinitions={kitchenMaterials}
        />
      ) : dbModel ? (
        <GLBFurnitureMesh
          modelId={dbModel.fileModelId ?? dbModel.id}
          basePath={`/api/models/files/${dbModel.fileModelId ?? dbModel.id}/`}
          glbFile={dbModel.glbFile}
          previewGlbFile={dbModel.previewGlbFile}
          preservePhysicalSize={dbModel.physicalSize}
          bakedOcclusionIntensity={0}
          trackFloorBand
          w={dims.w}
          d={dims.d}
          h={dims.h}
          selected={selected}
          deferUntilVisible
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
