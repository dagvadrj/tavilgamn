"use client";
import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import * as THREE from "three";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Grid,
  MapControls,
  Edges,
  useCursor,
} from "@react-three/drei";
import { SceneHtml as Html } from "./SceneHtml";
import type {
  RoomDesign,
  PlacedFurniture,
  RoomShape,
  RoomWall,
  RoomOpening,
  RoomInteriorCamera,
} from "@/lib/types";
import {
  connectionGeometry,
  layoutBounds,
  roomPosition,
} from "@/lib/roomLayout";
import { roomLabelOpacity, solarLighting } from "@/lib/roomLighting";
import { animateToward } from "./demandAnimation";
import { getRoomGeometry } from "@/lib/roomGeometry";
import { RoomStructure, RoomLighting } from "./RoomStructure";
import { PlannerEnvironment } from "./PlannerEnvironment";
import { configurePlannerRenderer } from "./plannerRenderer";
import { GLBFurnitureMesh } from "./GLBFurnitureMesh";
import { SelectionScreenAnchor } from "./SelectionScreenAnchor";

/** Selection is always this blue; load failures are red dashed (B2). */
const SELECTION_COLOR = "#075eaa";
import { InteriorModel } from "./InteriorModel";
import { getProduct } from "@/store/catalog";
import { getDbModel } from "@/lib/modelRegistry";
import { useRoomModelStatus } from "@/store/roomModelStatus";
import { roomPlacementContext } from "./roomPlacement";
import { isPlacementValid, snapToWall, type PlacementRoom } from "./collision";
import {
  clampDragPoint,
  floorSlideDirections,
  solveDragPoint,
  type DragPoint,
} from "./furnitureDragSolver";
import { createFrameCoalescer } from "./frameCoalescer";
import type { Measurement } from "@/lib/furnitureMeasurements";
import { KitchenAssemblyMesh } from "./KitchenAssemblyMesh";
import { dimsFor } from "./collision";
import { furnitureDragPlane } from "./furnitureDragPlane";
import { RoomPlacementHints, type RoomPlacementHintSource } from "./RoomPlacementHints";
import { furnitureCameraBounds } from "./roomFurnitureCamera";
import { RoomDimensions } from "./RoomDimensions";
import { FurnitureMeasurements } from "./FurnitureMeasurements";
import {
  normalizeKitchenMaterials,
  type KitchenMaterialDefinition,
} from "@/lib/kitchenMaterials";
import { useCanvasPerformance } from "./canvasPerformance";
import { CanvasDiagnostics } from "./CanvasDiagnostics";
import { CanvasLifecycle } from "./CanvasLifecycle";
import { RoomRendererBoundary } from "./RoomRendererBoundary";
import { CameraMotionPreview } from "./CameraMotionPreview";
import { ROOM_DAY_BACKDROP, ROOM_NIGHT_BACKDROP } from "@/lib/roomLighting";
import { RoomExportBridge } from "./RoomExportBridge";
import { PlannerMotionShadows, RoomContactShadows, RoomMotionResolution } from "./RoomMotionQuality";
import { roomTourCamera } from "./roomCameraPlacement";
import { RoomStreetView } from "./RoomStreetView";
import { RoomPreviewCapture } from "./RoomPreviewCapture";
import { RoomCameraRig } from "./RoomCameraRig";
import {
  RoomEntryController,
  type ExteriorMemory,
  type RoomEntryTransition,
} from "./RoomEntryController";
import {
  PLANNER_FURNITURE_GROUP,
  createInteriorEntryChannel,
} from "./roomEntryChannel";
import type { CameraPose } from "@/lib/cameraTransition";
import { CameraNavigation } from "./CameraNavigation";
import type { CameraRequest } from "@/lib/plannerCamera";
import { PLANNER_CAMERA } from "@/lib/plannerCameraProfile";
import { CursorNavigation } from "./CursorNavigationBinding";
import {
  furnitureWallId,
  resolveFurnitureAttachments,
  wallAttachedPiece,
} from "@/lib/furnitureAttachment";
import {
  SCENE_NAVIGATION_START,
  holdOrbitControls,
  isSceneNavigationGesture,
} from "./sceneNavigation";

// The camera and WebGL renderer survive room selection; the rig owns their pose.
const ROOM_CAMERA = {
  position: [6, 5, 6] as [number, number, number],
  fov: PLANNER_CAMERA.fov,
  near: 0.1,
  far: 300,
};

interface RoomCanvasProps {
  onRendererUnavailable?: (unavailable: boolean) => void;
  onViewSettled?: (view: "plan" | "perspective") => void;
  onExportReady?: (exporter: (() => Promise<Blob>) | null) => void;
  onPlacementHintsReady?: (source: RoomPlacementHintSource | null) => void;
  paused?: boolean;
  onPreview?: (id: string, image: string) => void;
  onPreviewReady?: (capture: (() => string | null) | null) => void;
  onSurfaceDoubleClick?: (
    surface: "wall" | "floor" | "ceiling",
    wall: RoomWall | undefined,
    x: number,
    y: number,
  ) => void;
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
  onMove: (
    id: string,
    x: number,
    z: number,
    pose?: Partial<
      Pick<PlacedFurniture, "elevation" | "rotation" | "attachment">
    >,
  ) => void;
  view: "plan" | "perspective";
  snapEnabled: boolean;
  /** When true, orbit controls are disabled so dragging furniture doesn't move camera */
  locked: boolean;
  gridEnabled?: boolean;
  showDimensions?: boolean;
  measurements?: Measurement[];
  resetKey?: number;
  cameraRequest?: CameraRequest;
  interior?: boolean;
  onCameraSave?: (pose: RoomInteriorCamera) => void;
  /** Scroll-in finished walking into the active room. */
  onEnterInterior?: (pose: RoomInteriorCamera) => void;
  /** Scroll-out finished walking back to the orbit view. */
  onExitInterior?: () => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  /** «Хасах» on a piece whose model failed to load (B2.4). */
  onRemovePiece?: (id: string) => void;
  /** D2: a failed replacement puts the previous product back. */
  onRevertSwap?: (id: string) => void;
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
  onRendererUnavailable,
  onViewSettled,
  onExportReady,
  onPlacementHintsReady,
  paused = false,
  onPreview,
  onPreviewReady,
  onSurfaceDoubleClick,
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
  interior = false,
  onCameraSave,
  onEnterInterior,
  onExitInterior,
  onEditStart,
  onEditEnd,
  onRemovePiece,
  onRevertSwap,
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
  const [isLooking, setIsLooking] = useState(false);
  const [entryTransition, setEntryTransition] =
    useState<RoomEntryTransition>(null);
  const entryChannel = useMemo(() => createInteriorEntryChannel(), []);
  const exteriorMemory = useRef<ExteriorMemory | null>(null);
  const restorePose = useRef<CameraPose | null>(null);
  // A wheel exit remounts CameraNavigation; it must not replay a request
  // (e.g. an earlier Fit) that was already handled before entering the room.
  const replayedRequest = useRef<number | undefined>(undefined);
  const [contextLost, setContextLost] = useState(false);
  const [rendererAttempt, setRendererAttempt] = useState(0);
  const rendererStatus = useCallback((lost: boolean) => {
    setContextLost(lost);
    onRendererUnavailable?.(lost);
  }, [onRendererUnavailable]);
  const [kitchenMaterials, setKitchenMaterials] = useState<
    Record<string, KitchenMaterialDefinition>
  >({});
  const rooms = useMemo(() => design.rooms ?? [], [design.rooms]);
  const tourPoints = useMemo(
    () => new Map(rooms.map((room) => [room.id, roomTourCamera(room)])),
    [rooms],
  );
  const activeRoom = rooms.find((room) => room.id === design.activeRoomId);
  const origin = activeRoom ? roomPosition(activeRoom) : { x: 0, z: 0 };
  const interiorPose = useMemo(
    () => tourPoints.get(design.activeRoomId ?? "") ?? roomTourCamera(design),
    [tourPoints, design],
  );
  const activeBounds = getRoomGeometry(design).bounds;
  const wallFocus: [number, number] = [
    (activeBounds.minX + activeBounds.maxX) / 2,
    (activeBounds.minZ + activeBounds.maxZ) / 2,
  ];
  const solar = solarLighting(design.lighting);
  const hasKitchen = (
    rooms.length ? rooms.flatMap((room) => room.pieces) : design.pieces
  ).some((piece) => piece.kitchen);
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
  const worldBounds =
    !customInterior && rooms.length
      ? layoutBounds(rooms)
      : getRoomGeometry(design).bounds;
  const bounds =
    !customInterior && rooms.length
      ? {
          minX: worldBounds.minX - origin.x,
          maxX: worldBounds.maxX - origin.x,
          minZ: worldBounds.minZ - origin.z,
          maxZ: worldBounds.maxZ - origin.z,
        }
      : worldBounds;
  const spanX = bounds.maxX - bounds.minX,
    spanZ = bounds.maxZ - bounds.minZ;
  const centerX = (bounds.minX + bounds.maxX) / 2,
    centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const roomHeight = Math.max(
    design.height ?? 2.7,
    ...rooms.map((room) => room.height ?? 2.7),
  );
  const cameraTarget = cameraRequest?.targetId
    ? design.pieces.find((piece) => piece.instanceId === cameraRequest.targetId)
    : undefined;
  return (
    <div className="relative h-full w-full" data-room-context={contextLost ? "lost" : "ready"}>
    <RoomRendererBoundary onUnavailable={onRendererUnavailable}>
    <Canvas
      key={rendererAttempt}
      shadows={performance.shadows}
      dpr={performance.dpr}
      frameloop={paused ? "never" : "demand"}
      gl={{
        antialias: true,
        // ContactShadows clears its offscreen capture with scene.background=null.
        // A transparent clear is essential; alpha:false makes the empty map opaque
        // and darkens the entire floor. The main scene still paints its background.
        alpha: true,
        powerPreference: "high-performance",
        preserveDrawingBuffer: true,
      }}
      onCreated={({ gl }) => {
        gl.setClearAlpha(0);
        configurePlannerRenderer(gl);
      }}
      camera={ROOM_CAMERA}
      className="!h-full !w-full"
      onPointerMissed={() => {
        onSelect(null);
        onSelectOpening?.(null);
      }}
    >
      <CanvasLifecycle paused={Boolean(paused)} onUnavailable={rendererStatus} />
      <CameraMotionPreview
        interactionActive={isDraggingPiece || isLooking || entryTransition !== null}
      >
        {onExportReady && <RoomExportBridge onReady={onExportReady} />}
        {onPlacementHintsReady && <RoomPlacementHints designId={design.id} roomId={design.activeRoomId ?? `${design.id}-room-1`} onReady={onPlacementHintsReady} />}
        <RoomMotionResolution dpr={performance.dpr} />
        <PlannerMotionShadows updatingLayout={isDraggingPiece} revision={design.updatedAt} />
        <CanvasDiagnostics scene="room" />
        <RoomPreviewCapture
          designId={design.id}
          revision={design.updatedAt}
          bounds={bounds}
          height={roomHeight}
          rooms={rooms}
          origin={origin}
          onCapture={onPreview}
          onReady={onPreviewReady}
        />
        {!interior && (
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
            restore={restorePose}
          />
        )}
        {interior && (
          <RoomStreetView
            roomId={design.activeRoomId ?? design.id}
            pose={interiorPose}
            locked={locked}
            request={cameraRequest}
            onSave={onCameraSave}
            room={design}
            onLookingChange={setIsLooking}
            channel={entryChannel}
          />
        )}
        {!customInterior && (
          <RoomEntryController
            interior={interior}
            enabled={
              view === "perspective" &&
              !locked &&
              !isDraggingPiece
            }
            roomId={design.activeRoomId ?? design.id}
            pose={interiorPose}
            bounds={activeBounds}
            height={design.height ?? 2.7}
            originX={origin.x}
            originZ={origin.z}
            channel={entryChannel}
            memory={exteriorMemory}
            abortKey={cameraRequest?.id}
            onTransition={setEntryTransition}
            onEnter={onEnterInterior}
            onExit={
              onExitInterior &&
              ((pose) => {
                restorePose.current = pose;
                replayedRequest.current = cameraRequest?.id;
                onExitInterior();
              })
            }
          />
        )}
        <color
          attach="background"
          args={[solar.night ? ROOM_NIGHT_BACKDROP : ROOM_DAY_BACKDROP]}
        />
        <RoomLighting
          windowDaylight={false}
          fixtureShadows={performance.shadows && rooms.length <= 6}
          design={{
            ...design,
            lighting: customInterior
              ? design.lighting
              : { ...design.lighting!, fixtureLayout: "manual", fixtures: [] },
          }}
          extent={Math.max(spanX, spanZ) * 0.8 + 4}
          centre={[centerX, centerZ]}
        />
        <PlannerEnvironment daylight={solar.daylight} />
        {!customInterior && view === "perspective" && (
          <mesh
            position={[centerX, -0.091, centerZ]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow={false}
            raycast={() => {}}
          >
            <planeGeometry
              args={[Math.max(60, spanX * 4), Math.max(60, spanZ * 4)]}
            />
            <meshBasicMaterial
              color={solar.night ? ROOM_NIGHT_BACKDROP : ROOM_DAY_BACKDROP}
              toneMapped={false}
            />
          </mesh>
        )}
        {customInterior ? (
          <group userData={{ roomExport: true }}>
          <InteriorModel
            basePath={customInterior.basePath}
            glbName={customInterior.glb}
            scale={customInterior.scale ?? 1}
            onError={customInterior.onError}
            onLoaded={customInterior.onLoaded}
          />
          </group>
        ) : rooms.length ? (
          <>
            {rooms.map((room) => {
              const active = room.id === design.activeRoomId,
                p = roomPosition(room);
              const shared = connectionGeometry(
                room,
                rooms,
                design.connections ?? [],
              );
              const roomDesign = {
                ...design,
                ...room,
                id: design.id,
                roomName: room.name,
                roomType: room.type,
                openings: shared.visibleOpenings,
              };
              return (
                <group
                  key={room.id}
                  userData={{ roomExport: true }}
                  position={[p.x - origin.x, 0, p.z - origin.z]}
                >
                  <RoomStructure
                    onSurfaceDoubleClick={
                      active ? onSurfaceDoubleClick : undefined
                    }
                    design={roomDesign}
                    view={view}
                    sharedCuts={shared.cuts}
                    sharedBoundaries={shared.boundaries}
                    connectionOpenings={shared.openings}
                    interior={interior && entryTransition !== "exiting"}
                    readOnly={!active || interior}
                    wallFocus={wallFocus}
                    onSelect={active ? onSelect : () => onSelectRoom?.(room.id)}
                    selectedWall={active ? selectedWall : null}
                    onSelectWall={active ? onSelectWall : undefined}
                    selectedOpening={active ? selectedOpening : null}
                    onSelectOpening={
                      active ? onSelectOpening : () => onSelectRoom?.(room.id)
                    }
                    onUpdateOpening={active ? onUpdateOpening : undefined}
                    placementTemplate={active ? placementTemplate : null}
                    onPlaceOpening={active ? onPlaceOpening : undefined}
                    onPlacementError={onPlacementError}
                    onDragChange={setIsDraggingPiece}
                    onEditStart={onEditStart}
                    onEditEnd={onEditEnd}
                  />
                  <RoomLighting
                    design={roomDesign}
                    includeSun={false}
                    windowDaylight={rooms.length <= 6 || active}
                    fixtureShadows={performance.shadows && rooms.length <= 6}
                  />
                  {!active &&
                    room.pieces.map((piece) => (
                      <DraggablePiece
                        key={piece.instanceId}
                        piece={piece}
                        allPieces={room.pieces}
                        roomDims={room}
                        selected={false}
                        onSelect={() => onSelectRoom?.(room.id)}
                        onMove={() => {}}
                        onDragChange={setIsDraggingPiece}
                        snapEnabled={false}
                        gridEnabled={false}
                        measureMode={true}
                        kitchenMaterials={kitchenMaterials}
                      />
                    ))}
                  {!interior && (
                    <RoomCaption
                      name={room.name}
                      area={getRoomGeometry(room).area}
                      span={Math.max(room.width, room.depth)}
                      active={active}
                      onSelect={() => onSelectRoom?.(room.id)}
                    />
                  )}
                </group>
              );
            })}
          </>
        ) : (
          <group userData={{ roomExport: true }}>
            <RoomStructure
              onSurfaceDoubleClick={onSurfaceDoubleClick}
              interior={interior && entryTransition !== "exiting"}
              design={design}
              onSelect={onSelect}
              view={view}
              selectedWall={selectedWall}
              onSelectWall={onSelectWall}
              selectedOpening={selectedOpening}
              onSelectOpening={onSelectOpening}
              onUpdateOpening={onUpdateOpening}
              placementTemplate={placementTemplate}
              onPlaceOpening={onPlaceOpening}
              onPlacementError={onPlacementError}
              onDragChange={setIsDraggingPiece}
              onEditStart={onEditStart}
              onEditEnd={onEditEnd}
            />
            <RoomLighting
              design={design}
              includeSun={false}
              fixtureShadows={performance.shadows}
            />
          </group>
        )}

        {!customInterior && gridEnabled && (
          <group position={[centerX, 0, centerZ]}>
            <FloorGrid width={spanX} depth={spanZ} />
          </group>
        )}
        {!customInterior &&
          showDimensions &&
          !selected &&
          (rooms.length ? (
            rooms.map((room) => {
              const p = roomPosition(room);
              return (
                <group
                  key={"dimensions-" + room.id}
                  position={[p.x - origin.x, 0, p.z - origin.z]}
                >
                  <RoomDimensions
                    room={room}
                    neighbours={rooms}
                    name={room.name}
                    active={room.id === design.activeRoomId}
                  />
                </group>
              );
            })
          ) : (
            <RoomDimensions room={design} name={design.roomName} />
          ))}
        {showDimensions && selected && (
          <FurnitureMeasurements measurements={measurements} view={view} />
        )}

        <group name={PLANNER_FURNITURE_GROUP} userData={{ roomExport: true }}>{design.pieces.map((piece) => (
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
            plan={view === "plan"}
            onEditStart={onEditStart}
            onEditEnd={onEditEnd}
            onRemove={onRemovePiece}
            onRevertSwap={onRevertSwap}
            kitchenMaterials={kitchenMaterials}
          />
        ))}</group>

        {view === "perspective" && performance.contactShadows && (
          <RoomContactShadows
            updatingLayout={isDraggingPiece}
            // The floor surface is y=0. A receiver below it is fully occluded.
            position={[centerX, 0.003, centerZ]}
            opacity={0.5}
            scale={Math.max(spanX, spanZ) * 1.15}
            resolution={512}
            blur={2}
            far={1.8}
            color="#4b5260"
          />
        )}
        {!interior && view === "perspective" && (
          <OrbitControls
            makeDefault
            enabled={!locked && !isDraggingPiece && entryTransition !== "entering"}
            enablePan
            screenSpacePanning
            enableRotate
            enableZoom
            zoomToCursor
            enableDamping
            dampingFactor={PLANNER_CAMERA.dampingFactor}
            rotateSpeed={PLANNER_CAMERA.rotateSpeed}
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
        {!interior && (
          <CameraNavigation
            onRest={() => onViewSettled?.(view)}
            enabled={!locked && !isDraggingPiece}
            request={
              (cameraRequest?.targetId && !cameraTarget) ||
              cameraRequest?.id === replayedRequest.current
                ? undefined
                : cameraRequest
            }
            plan={view === "plan"}
            // Mouse 1 on empty space orbits; furniture presses hold the controls.
            leftDrag={view !== "plan"}
            bounds={cameraTarget ? furnitureCameraBounds(cameraTarget) : {
              width: spanX,
              depth: spanZ,
              height: roomHeight,
              centerX,
              centerZ,
            }}
          />
        )}
        {!interior && (
          <CursorNavigation
            smoothZoom
            // A second finger must be able to cancel an object drag. The
            // controls' enabled flag already prevents wheel zoom during a drag.
            enabled={!locked && !interior}
            plan={view === "plan"}
          />
        )}
      </CameraMotionPreview>
    </Canvas>
    </RoomRendererBoundary>
    {contextLost && (
      <div role="status" className="absolute inset-0 z-10 grid place-content-center bg-white/90 p-6 text-center text-sm text-slate-700">
        <p>3D харагдац түр тасарлаа. Сэргээж байна…</p>
        <p className="mt-2 text-xs">Таны өрөөний төлөвлөгөө хэвээр байна.</p>
        <button type="button" className="mx-auto mt-4 rounded-xl bg-blue-600 px-5 py-3 text-white" onClick={() => {
          setContextLost(false);
          setRendererAttempt(value => value + 1);
        }}>3D дахин ачаалах</button>
      </div>
    )}
    </div>
  );
}
function RoomCaption({
  name,
  area,
  span,
  active,
  onSelect,
}: {
  name: string;
  area: number;
  span: number;
  active: boolean;
  onSelect: () => void;
}) {
  const anchor = useRef<THREE.Group>(null),
    button = useRef<HTMLButtonElement>(null);
  const world = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, invalidate }, delta) => {
    if (!anchor.current || !button.current) return;
    anchor.current.getWorldPosition(world);
    const target = roomLabelOpacity(camera.position.distanceTo(world), span);
    const current = Number(button.current.style.opacity || 1);
    const animation = animateToward(current, target, 9, delta);
    button.current.style.opacity = String(animation.value);
    button.current.style.visibility =
      animation.value < 0.015 ? "hidden" : "visible";
    button.current.style.pointerEvents =
      animation.value < 0.1 ? "none" : "auto";
    if (animation.moving) invalidate();
  });
  return (
    <group ref={anchor} position={[0, 0.35, 0]}>
      <Html center zIndexRange={[12, 0]}>
        <div className="flex items-center gap-2">
          <button
            ref={button}
            type="button"
            className="room-world-label"
            aria-pressed={active}
            onClick={onSelect}
          >
            <strong>{name}</strong>
            <small>{area.toFixed(1)} м²</small>
          </button>
        </div>
      </Html>
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
export function DraggablePiece({
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
  plan = false,
  onEditStart,
  onEditEnd,
  onRemove,
  onRevertSwap,
  kitchenMaterials,
}: {
  piece: PlacedFurniture;
  allPieces: PlacedFurniture[];
  onDragChange: (dragging: boolean) => void;
  roomDims: RoomShape;
  selected: boolean;
  onSelect: (id: string | null) => void;
  onMove: (
    id: string,
    x: number,
    z: number,
    pose?: Partial<
      Pick<PlacedFurniture, "elevation" | "rotation" | "attachment">
    >,
  ) => void;
  snapEnabled: boolean;
  gridEnabled: boolean;
  measureMode: boolean;
  plan?: boolean;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  onRemove?: (id: string) => void;
  onRevertSwap?: (id: string) => void;
  kitchenMaterials: Record<string, KitchenMaterialDefinition>;
}) {
  const [hovered, setHovered] = useState(false);
  const { camera, raycaster, gl, controls } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const dragOffset = useRef(new THREE.Vector3());
  const dragCapture = useRef<{ pointerId: number; target: Element } | null>(
    null,
  );
  const product = getProduct(piece.productId);
  const dbModel = piece.modelId ? getDbModel(piece.modelId) : undefined;
  const fileModel = dbModel
    ? {
        id: dbModel.fileModelId ?? dbModel.id,
        file: dbModel.glbFile,
        physicalSize: dbModel.physicalSize,
      }
    : product?.model;
  const fileKey = fileModel ? `${fileModel.id}/${fileModel.file}` : null;
  useEffect(() => {
    if (fileKey) useRoomModelStatus.getState().begin(piece.instanceId);
  }, [fileKey, piece.instanceId]);
  useEffect(
    () => () => useRoomModelStatus.getState().clear(piece.instanceId),
    [piece.instanceId],
  );
  // «Дахин оролдох» remounts the mesh; the loader has already dropped the failure.
  const [attempt, setAttempt] = useState(0);
  // D1: a failed model shows only the red dashed volume, never blue over it.
  const [failed, setFailed] = useState(false);
  const [swapRetry, setSwapRetry] = useState(0);
  useEffect(
    () =>
      useRoomModelStatus.subscribe((state) => {
        setAttempt(state.attempts[piece.instanceId] ?? 0);
        setFailed(state.byInstance[piece.instanceId] === "error");
        setSwapRetry(state.swapRetries[piece.instanceId] ?? 0);
      }),
    [piece.instanceId],
  );
  const [dragging, setDragging] = useState(false);
  const dragBefore = useRef<PlacedFurniture | null>(null);
  const moveCallback = useRef(onMove);
  moveCallback.current = onMove;
  const heldControls = useRef<(() => void) | null>(null);
  const placeAt = useRef<(clientX: number, clientY: number) => void>(() => {});
  const mover = useRef<ReturnType<typeof createFrameCoalescer> | null>(null);
  if (!mover.current)
    mover.current = createFrameCoalescer((x, y) => placeAt.current(x, y));
  const moves = mover.current;

  useCursor(
    hovered || dragging,
    measureMode ? "crosshair" : dragging ? "grabbing" : "grab",
    "default",
  );

  useEffect(() => {
    if (!dragging) return;

    const releaseControls = () => {
      heldControls.current?.();
      heldControls.current = null;
    };
    const finishDrag = (event?: Event) => {
      if (event && "pointerId" in event && dragCapture.current && event.pointerId !== dragCapture.current.pointerId) return;
      const before = dragBefore.current;
      dragBefore.current = null;
      if (before && event && event.type !== "pointerup") {
        moves.cancel();
        moveCallback.current(before.instanceId, before.x, before.z, {
          elevation: before.elevation,
          rotation: before.rotation,
          attachment: before.attachment,
        });
      } else if (before) moves.flush();
      releaseControls();
      const capture = dragCapture.current;
      dragCapture.current = null;
      try {
        capture?.target.releasePointerCapture?.(capture.pointerId);
      } catch {
        /* Capture may already be released. */
      }
      setDragging(false);
      onDragChange(false);
      onEditEnd?.();
    };
    // Window capture listeners keep an active drag alive outside the room
    // meshes and the canvas, and before any scene handler stops propagation.
    const move = (event: PointerEvent) => {
      if (dragCapture.current?.pointerId === event.pointerId)
        moves.push(event.clientX, event.clientY);
    };

    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", finishDrag, true);
    window.addEventListener("pointercancel", finishDrag, true);
    window.addEventListener("blur", finishDrag);
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); finishDrag(event); } };
    window.addEventListener("keydown", escape);
    window.addEventListener("lostpointercapture", finishDrag, true);
    gl.domElement.addEventListener(SCENE_NAVIGATION_START, finishDrag);

    return () => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", finishDrag, true);
      window.removeEventListener("pointercancel", finishDrag, true);
      window.removeEventListener("blur", finishDrag);
      window.removeEventListener("keydown", escape);
      window.removeEventListener("lostpointercapture", finishDrag, true);
      gl.domElement.removeEventListener(SCENE_NAVIGATION_START, finishDrag);
      moves.cancel();
      releaseControls();
      onDragChange(false);
      onEditEnd?.();
    };
  }, [dragging, onDragChange, onEditEnd, gl, moves]);

  if (!fileModel && !piece.kitchen && !piece.details) return null;

  const dims = piece.kitchen
    ? dimsFor(piece)
    : dbModel
      ? {
          w: dbModel.dimensionsW,
          d: dbModel.dimensionsD,
          h: dbModel.dimensionsH,
        }
      : {
          ...dimsFor(piece),
        };

  const planeY = piece.elevation ?? 0;
  const intersectFloor = (clientX: number, clientY: number, extend = false) => {
    const rect = gl.domElement.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
    const plane = furnitureDragPlane(piece, roomDims, plan);
    if (!plane) return null;
    const point = new THREE.Vector3();
    const hit = raycaster.ray.intersectPlane(plane, point);
    if (hit || !extend) return hit;
    // Above the horizon the ray never meets the plane. Keep following its
    // heading; placement then resolves to the nearest valid wall contact.
    const heading = raycaster.ray.direction.clone().projectOnPlane(plane.normal);
    if (heading.lengthSq() < 1e-10) return null;
    return plane
      .projectPoint(raycaster.ray.origin, point)
      .addScaledVector(heading.normalize(), 50);
  };
  placeAt.current = (clientX, clientY) => {
    const p = intersectFloor(clientX, clientY, true);
    if (!p) return;
    const attachment = piece.attachment;
    const desired = p.add(dragOffset.current);
    const wall =
      attachment?.kind === "wall"
        ? getRoomGeometry(roomDims).segments.find(
            (s) => furnitureWallId(s) === attachment.segmentId,
          )
        : undefined;
    if (attachment?.kind === "wall" && !wall) return;
    const parent =
      attachment?.kind === "surface"
        ? allPieces.find((p) => p.instanceId === attachment.parentInstanceId)
        : undefined;
    if (attachment?.kind === "surface" && !parent) return;
    const build = (point: DragPoint): PlacedFurniture | null => {
      try {
        if (attachment?.kind === "wall")
          return wallAttachedPiece(
            piece,
            roomDims,
            attachment.roomId,
            attachment.segmentId,
            point[0],
            point[1],
          );
        if (attachment?.kind === "surface" && parent) {
          const x = point[0] - parent.x,
            z = point[1] - parent.z,
            cos = Math.cos(parent.rotation),
            sin = Math.sin(parent.rotation);
          const moved: PlacedFurniture = {
            ...piece,
            attachment: {
              ...attachment,
              localPosition: [
                x * cos - z * sin,
                attachment.localPosition[1],
                x * sin + z * cos,
              ],
            },
          };
          return resolveFurnitureAttachments(
            allPieces.map((p) => (p.instanceId === moved.instanceId ? moved : p)),
            roomDims,
            "id" in roomDims ? String(roomDims.id) : "",
            moved.instanceId,
          )[0];
        }
        const moved = { ...piece, x: point[0], z: point[1] };
        return attachment?.kind === "floor"
          ? { ...moved, attachment: { ...attachment, x: moved.x, z: moved.z, yaw: moved.rotation } }
          : moved;
      } catch {
        return null;
      }
    };
    const boundary = { ...roomDims, allowFurnitureOverlap: true };
    const supportsOthers = allPieces.some((p) => p.attachment?.kind === "surface");
    const owned = ("pieces" in roomDims ? roomDims.pieces : allPieces) as PlacedFurniture[];
    const valid = (candidate: PlacedFurniture) => {
      if (!isPlacementValid(candidate, allPieces, boundary)) return false;
      if (!supportsOthers) return true;
      try {
        const resolved = resolveFurnitureAttachments(
          owned.map((p) => (p.instanceId === candidate.instanceId ? candidate : p)),
          roomDims,
          "id" in roomDims ? String(roomDims.id) : "",
        );
        const combined = allPieces.map(
          (p) => resolved.find((r) => r.instanceId === p.instanceId) ?? p,
        );
        return resolved.every((p) => isPlacementValid(p, combined, boundary));
      } catch {
        return false;
      }
    };
    const accept = (point: DragPoint) => {
      const candidate = build(point);
      return !!candidate && valid(candidate);
    };
    let from: DragPoint, target: DragPoint, directions: DragPoint[];
    if (wall && attachment?.kind === "wall") {
      const along =
        ((desired.x - wall.a.x) * (wall.b.x - wall.a.x) +
          (desired.z - wall.a.z) * (wall.b.z - wall.a.z)) /
        wall.length;
      from = [attachment.along, attachment.elevation];
      target = [
        Math.max(0, Math.min(wall.length, along)),
        Math.max(0, Math.min(roomDims.height ?? 2.7, desired.y)),
      ];
      directions = [[1, 0], [0, 1]];
    } else {
      from = [piece.x, piece.z];
      target = [desired.x, desired.z];
      if (gridEnabled && !attachment)
        target = [Math.round(target[0] * 4) / 4, Math.round(target[1] * 4) / 4];
      if (snapEnabled && !attachment) {
        const snapped = snapToWall({ ...piece, x: target[0], z: target[1] }, roomDims);
        target = [snapped.x, snapped.z];
      }
      const room = roomDims as PlacementRoom;
      target = clampDragPoint(target, (room.placementGeometry ?? getRoomGeometry(roomDims)).bounds);
      directions = floorSlideDirections(room, target);
    }
    // Validation stays on: the solver only ever returns an accepted point.
    const candidate = build(solveDragPoint({ from, to: target, accept, directions }));
    if (
      !candidate ||
      (candidate.x === piece.x &&
        candidate.z === piece.z &&
        candidate.elevation === piece.elevation)
    )
      return;
    moveCallback.current(piece.instanceId, candidate.x, candidate.z, {
      elevation: candidate.elevation,
      rotation: candidate.rotation,
      attachment: candidate.attachment,
    });
  };

  return (
    <group
      ref={groupRef}
      position={[piece.x, planeY, piece.z]}
      rotation={[0, piece.rotation, 0]}
      onClick={(event) => {
        event.stopPropagation();
        // Opening the mobile inspector resizes the canvas. Wait until the tap's
        // click has a target so it cannot land on a newly shifted room hotspot.
        onSelect(piece.instanceId);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => {
        setHovered(false);
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        if (
          event.pointerType === "touch" &&
          isSceneNavigationGesture(gl.domElement)
        )
          return;
        event.stopPropagation();

        if (measureMode) {
          if (event.pointerType !== "touch") onSelect(piece.instanceId);
          return;
        }
        const point = intersectFloor(event.clientX, event.clientY);
        if (!point) return;
        heldControls.current?.();
        heldControls.current = holdOrbitControls(controls);
        onEditStart?.();
        dragBefore.current = structuredClone(piece);

        dragOffset.current.set(
          piece.x - point.x,
          planeY - point.y,
          piece.z - point.z,
        );

        if (event.pointerType !== "touch") onSelect(piece.instanceId);
        setDragging(true);
        onDragChange(true);

        (event.target as Element).setPointerCapture?.(event.pointerId);
        dragCapture.current = {
          pointerId: event.pointerId,
          target: event.target as Element,
        };
      }}
      onPointerMove={(event) => {
        if (!dragging || measureMode) return;
        if (dragCapture.current?.pointerId !== event.pointerId) return;
        moves.push(event.clientX, event.clientY);
      }}
      onPointerUp={(event) => {
        if (!dragging) return;
        if (dragCapture.current?.pointerId !== event.pointerId) return;
        moves.flush();
        dragBefore.current = null;
        dragCapture.current = null;
        setDragging(false);
        onDragChange(false);
        onEditEnd?.();

        (event.target as Element).releasePointerCapture?.(event.pointerId);
      }}
    >
      {piece.kitchen ? (
        <KitchenAssemblyMesh
          kitchen={piece.kitchen.design}
          centered
          materialDefinitions={kitchenMaterials}
        />
      ) : fileModel ? (
        <GLBFurnitureMesh
          key={attempt}
          modelId={fileModel.id}
          basePath={`/api/models/files/${fileModel.id}/`}
          glbFile={fileModel.file}
          preservePhysicalSize={fileModel.physicalSize}
          // Physical sun/contact shadows already darken contacts. Authored AO on
          // top crushes fabric colour (docs/room-realism.md); quality-baked AO stays.
          bakedOcclusionIntensity={0}
          trackFloorBand
          w={dims.w}
          d={dims.d}
          h={dims.h}
          selected={selected}
          deferUntilVisible
          onReady={() =>
            useRoomModelStatus.getState().set(piece.instanceId, "ready")
          }
          onError={() =>
            useRoomModelStatus.getState().set(piece.instanceId, "error")
          }
          sceneStatus={{
            floorOffset: planeY,
            onRetry: () => useRoomModelStatus.getState().retry(piece.instanceId),
            onRemove: onRemove && (() => onRemove(piece.instanceId)),
            // The previous variant stays on screen at full opacity (B2.5).
            onSwapError: () =>
              useRoomModelStatus.getState().swapError(piece.instanceId),
            onSwapRetry: () =>
              useRoomModelStatus.getState().retrySwap(piece.instanceId),
            retrySignal: swapRetry,
            onRevert: onRevertSwap && (() => onRevertSwap(piece.instanceId)),
          }}
        />
      ) : piece.details ? (
        <Html center position={[0, dims.h / 2, 0]} zIndexRange={[8, 0]}>
          <span className="whitespace-nowrap rounded border bg-white px-3 py-2 text-xs">
            3D загвар холбогдоогүй
          </span>
        </Html>
      ) : null}
      {selected && !failed && (
        <mesh position={[0, dims.h / 2, 0]}>
          <boxGeometry args={[dims.w + 0.04, dims.h + 0.04, dims.d + 0.04]} />

          <meshBasicMaterial
            transparent
            opacity={0}
            depthWrite={false}
            colorWrite={false}
          />

          <Edges color={SELECTION_COLOR} lineWidth={1.25} threshold={15} />
        </mesh>
      )}
      {selected &&
        !failed &&
        (!piece.attachment || piece.attachment.kind === "floor") && (
        // Floor footprint under the piece, turned with it (the group carries the yaw).
        <mesh
          position={[0, -planeY + 0.006, 0]}
          rotation-x={-Math.PI / 2}
          renderOrder={2}
          raycast={() => null}
        >
          <planeGeometry args={[dims.w + 0.06, dims.d + 0.06]} />
          <meshBasicMaterial
            color={SELECTION_COLOR}
            transparent
            opacity={0.14}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-2}
          />
          <Edges color={SELECTION_COLOR} lineWidth={1.5} threshold={15} />
        </mesh>
      )}
      {selected && (
        <SelectionScreenAnchor
          instanceId={piece.instanceId}
          w={dims.w}
          h={dims.h}
          d={dims.d}
        />
      )}
    </group>
  );
}
