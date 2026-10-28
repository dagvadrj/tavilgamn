"use client";

import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { Edges, OrbitControls } from "@react-three/drei";
import { useCanvasPerformance } from "./canvasPerformance";
import { CameraMotionPreview } from "./CameraMotionPreview";
import { CanvasDiagnostics } from "./CanvasDiagnostics";
import { KitchenAmbientOcclusion } from "./KitchenAmbientOcclusion";
import { PlannerMotionShadows, RoomContactShadows, RoomMotionResolution } from "./RoomMotionQuality";
import {
  Plane,
  Object3D,
  Vector3,
  type Group,
  type PerspectiveCamera,
} from "three";
import {
  type CabinetPose,
  type ModularCabinet,
  type ModularKitchen,
} from "@/lib/kitchenCabinets";
import { placementIssues } from "@/lib/kitchenPlacement";
import { kitchenEnvelope } from "@/lib/kitchenAssembly";
import { kitchenVariantMatchesRole, type KitchenCatalogVariant } from "@/lib/kitchenModuleCatalog";
import { KitchenTops } from "./KitchenTops";
import { KitchenCabinetGLB } from "./KitchenCabinetGLB";
import type { KitchenMaterialDefinition } from "@/lib/kitchenMaterials";
import { KitchenExtraMesh } from "./KitchenExtraMesh";
import { CameraNavigation } from "./CameraNavigation";
import { KitchenInteriorView } from "./KitchenInteriorView";
import { KitchenRoomShell } from "./KitchenRoomShell";
import { PlannerEnvironment } from "./PlannerEnvironment";
import { configurePlannerRenderer } from "./plannerRenderer";
import { plannerLighting } from "@/lib/plannerLighting";
import { kitchenDaylight } from "@/lib/kitchenDaylight";
import { ROOM_DAY_BACKDROP } from "@/lib/roomLighting";
import type { CameraRequest } from "@/lib/plannerCamera";
import { PLANNER_CAMERA } from "@/lib/plannerCameraProfile";
import { applyCameraPose, cameraPose, cancelCameraTransition } from "@/lib/cameraTransition";
import type { NavigationControls } from "@/lib/plannerCamera";
import { CursorNavigation } from "./CursorNavigationBinding";
import {
  SCENE_NAVIGATION_START,
  isSceneNavigationGesture,
} from "./sceneNavigation";

export interface ModularSceneProps {
  exportRoot?: (root: Group | null) => void;
  capture?: (capture: (() => Promise<Blob | null>) | null) => void;
  open?: boolean;
  kitchen: ModularKitchen;
  selectedId: string | null;
  mode: "move" | "orbit";
  interior?: boolean;
  cameraRequest?: CameraRequest;
  onSelect: (id: string) => void;
  onSelectCountertop?: (id: string) => void;
  onDeselect?: () => void;
  onStart: (id: string) => void;
  onMove: (id: string, pose: CabinetPose) => void;
  onEnd: () => void;
  onCancel: () => void;
  variantModels?: Record<string, KitchenCatalogVariant>;
  materialDefinitions?: Record<string, KitchenMaterialDefinition>;
}
/** Kitchen-only light balance (the shared room planner values stay as they are). */
const KITCHEN_FILL = 0.62;
const KITCHEN_WINDOW_SUN = 1.75;
/** Candela, at the ceiling centre; tuned against the fill so the room shows a direction. */
const KITCHEN_CEILING_LIGHT = 16;

function CameraFit({ focus, side }: { focus: ReturnType<typeof kitchenEnvelope>; side: [number, number] }) {
  const { camera, size, controls } = useThree();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || !controls || !("target" in controls)) return;
    fitted.current = true;
    const perspective = camera as PerspectiveCamera;
    perspective.fov = PLANNER_CAMERA.fov;
    perspective.near = 0.1;
    perspective.zoom = 1;
    const target = new Vector3(
      focus.centerX / 1000,
      focus.h / 2,
      focus.centerZ / 1000,
    );
    const distance =
      Math.max(focus.w, focus.d, focus.h, 1.5) *
      Math.max(1.6, (size.height / Math.max(1, size.width)) * 1.8);
    camera.position
      .copy(target)
      // Open on the side facing the window so its wall and daylight stay in view.
      .add(new Vector3(side[0] * 1.12, 0.85, side[1] * 1.12).normalize().multiplyScalar(distance));
    (controls as unknown as NavigationControls).target.copy(target);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }, [camera, controls, focus, side, size.width, size.height]);
  return null;
}
type CaptureTarget = {
  setPointerCapture: (id: number) => void;
  releasePointerCapture: (id: number) => void;
};
function Scene(props: ModularSceneProps & { dpr: number | [number, number]; contactShadows: boolean }) {
  const { capture: registerCapture, kitchen, selectedId, mode } = props;
  // Stable while dragging; layout selection remounts this view to frame the new layout.
  const focus = useRef({
    ...kitchenEnvelope(kitchen),
    w: kitchen.room.width / 1000,
    d: kitchen.room.depth / 1000,
    h: kitchen.room.height / 1000,
    centerX: kitchen.room.width / 2,
    centerZ: kitchen.room.depth / 2,
  }).current;
  const { camera, gl, invalidate, scene, controls } = useThree();
  const callbacks = useRef(props);
  callbacks.current = props;
  const [dragActive, setDragActive] = useState(false);
  const drag = useRef<{
    id: string;
    pointerId: number;
    plane: Plane;
    offset: Vector3;
    pose: CabinetPose;
    target: CaptureTarget;
  } | null>(null);
  const invalid = new Set(
    placementIssues(kitchen)
      .filter((issue) => issue.severity === "error")
      .flatMap((issue) => issue.ids),
  );
  function finish(cancel: boolean) {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    if (controls && "enabled" in controls) controls.enabled = true;
    setDragActive(false);
    try {
      current.target.releasePointerCapture(current.pointerId);
    } catch {
      /* Pointer may already have been released by the browser. */
    }
    if (cancel) callbacks.current.onCancel();
    else callbacks.current.onEnd();
  }
  const finishRef = useRef(finish);
  finishRef.current = finish;
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") finishRef.current(true);
    };
    const cancel = () => finishRef.current(true);
    const lostCapture = (event: PointerEvent) => {
      if (drag.current?.pointerId === event.pointerId) cancel();
    };
    window.addEventListener("keydown", escape);
    window.addEventListener("blur", cancel);
    gl.domElement.addEventListener("lostpointercapture", lostCapture);
    gl.domElement.addEventListener(SCENE_NAVIGATION_START, cancel);
    return () => {
      window.removeEventListener("keydown", escape);
      window.removeEventListener("blur", cancel);
      gl.domElement.removeEventListener("lostpointercapture", lostCapture);
      gl.domElement.removeEventListener(SCENE_NAVIGATION_START, cancel);
      cancel();
    };
  }, [gl]);
  useEffect(() => {
    if (!registerCapture) return;
    const capture = async () => {
      let pending = false;
      scene.traverse((object) => {
        if (object.userData.deliveryPending && !object.userData.exportExclude)
          pending = true;
      });
      if (pending) return null; // Never persist a preview/placeholder as a completed thumbnail.
      const hidden: { visible: boolean; object: { visible: boolean } }[] = [];
      scene.traverse((object) => {
        if (object.userData.exportExclude && object.visible) {
          hidden.push({ object, visible: object.visible });
          object.visible = false;
        }
      });
      try {
        gl.render(scene, camera);
        return await new Promise<Blob | null>((resolve) =>
          gl.domElement.toBlob(resolve, "image/webp", 0.88),
        );
      } finally {
        hidden.forEach(({ object, visible }) => {
          object.visible = visible;
        });
        invalidate();
      }
    };
    registerCapture(capture);
    return () => registerCapture(null);
  }, [camera, gl, invalidate, registerCapture, scene]);
  function start(
    event: ThreeEvent<PointerEvent>,
    cabinet: Pick<ModularCabinet, "id" | "position">,
  ) {
    if (props.interior || event.button !== 0 || drag.current) return;
    // Shift + left drag pans even when the pointer starts over furniture.
    if (event.pointerType !== "touch" && event.shiftKey) return;
    if (
      event.pointerType === "touch" &&
      isSceneNavigationGesture(gl.domElement)
    )
      return;
    event.stopPropagation();
    props.onSelect(cabinet.id);
    if (mode !== "move") return;
    cancelCameraTransition(camera as PerspectiveCamera);
    if (controls && "target" in controls) {
      const orbit = controls as unknown as NavigationControls;
      // Clear residual orbit inertia at the current pose before fixing the drag plane.
      applyCameraPose(camera as PerspectiveCamera, cameraPose(camera as PerspectiveCamera, orbit.target), orbit);
    }
    const plane = new Plane(new Vector3(0, 1, 0), -event.point.y),
      point = new Vector3();
    if (!event.ray.intersectPlane(plane, point)) return;
    // Block native camera movement before the next pointer sample/React render.
    if (controls && "enabled" in controls) controls.enabled = false;
    const target = event.target as unknown as CaptureTarget;
    target.setPointerCapture(event.pointerId);
    drag.current = {
      id: cabinet.id,
      pointerId: event.pointerId,
      plane,
      pose: cabinet.position,
      target,
      offset: new Vector3(
        cabinet.position.x / 1000 - point.x,
        0,
        cabinet.position.z / 1000 - point.z,
      ),
    };
    setDragActive(true);
    props.onStart(cabinet.id);
  }
  function move(event: ThreeEvent<PointerEvent>) {
    const current = drag.current;
    if (!current || event.pointerId !== current.pointerId) return;
    event.stopPropagation();
    const point = event.ray.intersectPlane(current.plane, new Vector3());
    if (!point) return;
    point.add(current.offset);
    callbacks.current.onMove(current.id, {
      ...current.pose,
      x: Math.round(point.x * 1000),
      z: Math.round(point.z * 1000),
    });
  }
  const width = kitchen.room.width / 1000,
    depth = kitchen.room.depth / 1000;
  const roomHeight = kitchen.room.height / 1000;
  const lighting = plannerLighting();
  // Structural inputs only: paint and furniture changes keep the same sun.
  const daylightKey = JSON.stringify({ width: kitchen.room.width, depth: kitchen.room.depth, height: kitchen.room.height, items: kitchen.room.items ?? [] });
  const daylight = useMemo(() => kitchenDaylight(JSON.parse(daylightKey)), [daylightKey]);
  const sunlightTarget = useMemo(() => {
    const target = new Object3D();
    target.position.set(...daylight.target);
    return target;
  }, [daylight]);
  const fillTarget = useMemo(() => {
    const target = new Object3D();
    target.position.set(width / 2, roomHeight / 3, depth / 2);
    return target;
  }, [width, depth, roomHeight]);
  // The sun is aimed at the window, not the room centre: cover the whole room from there.
  const sunExtent = Math.hypot(width, depth) + 1;
  const ceilingLightTarget = useMemo(() => {
    const target = new Object3D();
    target.position.set(width / 2, 0, depth / 2);
    return target;
  }, [width, depth]);
  // Wide enough to reach the room corners from the ceiling centre.
  const ceilingLightAngle = Math.min(1.3, Math.atan(Math.hypot(width, depth) / 2 / roomHeight) + 0.25);
  const cameraTarget = props.cameraRequest?.targetId
    ? [...kitchen.cabinets, ...(kitchen.extras ?? [])].find(
        (cabinet) => cabinet.id === props.cameraRequest?.targetId,
      )
    : undefined;
  return (
    <CameraMotionPreview interactionActive={dragActive}>
      <RoomMotionResolution dpr={props.dpr} />
      <PlannerMotionShadows updatingLayout={dragActive || Boolean(props.open)} revision={kitchen} />
      <CanvasDiagnostics scene="modular-kitchen" />
      <KitchenAmbientOcclusion />
      {!props.interior && <CameraFit focus={focus} side={daylight.cameraSide} />}
      <color attach="background" args={[ROOM_DAY_BACKDROP]} />
      {/* Less uniform fill than the room planner: cabinet sides, plinths and
          the window patch need contrast to read as daylight, not a flat studio. */}
      <PlannerEnvironment daylight={lighting.solar.daylight} scale={KITCHEN_FILL} />
      <ambientLight color={lighting.ambientColor} intensity={lighting.ambientIntensity * KITCHEN_FILL} />
      <hemisphereLight args={[lighting.skyColor, lighting.groundColor, lighting.hemisphereIntensity]} />
      <primitive object={sunlightTarget} />
      <primitive object={fillTarget} />
      {/* Soft interior fill keeps fronts readable; it casts no second shadow. */}
      <directionalLight
        position={[width / 2, roomHeight * 0.9, depth * 0.85]}
        target={fillTarget}
        intensity={0.45}
        color="#fffefb"
      />
      {/* One sun through the real window: its frame and mullion shadow the floor. */}
      <directionalLight
        castShadow
        position={daylight.position}
        target={sunlightTarget}
        intensity={lighting.sunlightIntensity * (daylight.windowId ? KITCHEN_WINDOW_SUN : 1)}
        color={daylight.windowId && !lighting.solar.night ? "#ffe6c7" : lighting.sunColor}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-sunExtent}
        shadow-camera-right={sunExtent}
        shadow-camera-top={sunExtent}
        shadow-camera-bottom={-sunExtent}
        shadow-camera-far={Math.max(20, sunExtent * 2 + 12)}
        shadow-normalBias={0.015}
        shadow-bias={-0.0001}
      />
      <primitive object={ceilingLightTarget} />
      {/* Ceiling fixture: the walls and roof block the sun in a windowless room,
          so this is what shades the backsplash under wall units and darkens corners. */}
      <spotLight
        castShadow
        position={[width / 2, roomHeight - 0.06, depth / 2]}
        target={ceilingLightTarget}
        intensity={KITCHEN_CEILING_LIGHT * (daylight.windowId ? 0.4 : 1)}
        angle={ceilingLightAngle}
        penumbra={1}
        decay={2}
        color="#fff1dc"
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.05}
        shadow-camera-far={Math.max(6, Math.hypot(width, depth, roomHeight) + 1)}
        shadow-normalBias={0.02}
        shadow-bias={-0.0002}
      />
      {!props.interior && (
        <OrbitControls
          makeDefault
          enabled={!dragActive}
          zoomSpeed={0.8}
          enablePan
          screenSpacePanning
          zoomToCursor
          enableDamping
          dampingFactor={PLANNER_CAMERA.dampingFactor}
          rotateSpeed={PLANNER_CAMERA.rotateSpeed}
          minDistance={1}
          maxDistance={Math.max(18, Math.hypot(width, depth, roomHeight) * 4)}
          maxPolarAngle={Math.PI / 2.05}
        />
      )}
      {!props.interior && (
        <CameraNavigation
          leftDrag
          enabled={!dragActive}
          request={props.cameraRequest}
          bounds={
            cameraTarget
              ? {
                  width: cameraTarget.width / 1000,
                  depth: cameraTarget.depth / 1000,
                  height: cameraTarget.height / 1000,
                  centerX: cameraTarget.position.x / 1000,
                  centerZ: cameraTarget.position.z / 1000,
                  centerY:
                    (cameraTarget.position.y + cameraTarget.height / 2) / 1000,
                }
              : {
                  width,
                  depth,
                  height: roomHeight,
                  centerX: width / 2,
                  centerZ: depth / 2,
                }
          }
        />
      )}
      {!props.interior && <CursorNavigation smoothZoom enabled={!dragActive} />}
      {props.interior && (
        <KitchenInteriorView kitchen={kitchen} request={props.cameraRequest} />
      )}
      <KitchenRoomShell room={kitchen.room} interior={props.interior} interactionActive={dragActive} />
      <group
        ref={props.exportRoot}
        name="Kitchen"
        userData={{
          roomContactCaster: true,
          kitchenExport: true,
          units: "meters",
          authoringUnits: "millimeters",
        }}
        onPointerMove={move}
        onPointerUp={(event) => {
          if (drag.current?.pointerId === event.pointerId) {
            event.stopPropagation();
            finish(false);
          }
        }}
        onPointerCancel={(event) => {
          if (drag.current?.pointerId === event.pointerId) finish(true);
        }}
      >
        {kitchen.cabinets.map((cabinet) => {
          return (
            <group
              key={cabinet.id}
              name={`Cabinet-${cabinet.id}`}
              userData={{ cabinetId: cabinet.id, cabinetType: cabinet.type }}
              position={[
                cabinet.position.x / 1000,
                cabinet.position.y / 1000,
                cabinet.position.z / 1000,
              ]}
              rotation={[0, cabinet.position.rotation, 0]}
              onPointerDown={(event) => start(event, cabinet)}
              onPointerMove={move}
              onPointerUp={(event) => {
                if (drag.current?.pointerId === event.pointerId) {
                  event.stopPropagation();
                  finish(false);
                }
              }}
              onPointerCancel={(event) => {
                if (drag.current?.pointerId === event.pointerId) finish(true);
              }}
            >
              <KitchenCabinetGLB
                cabinet={cabinet}
                selected={selectedId === cabinet.id}
                materialDefinitions={props.materialDefinitions}
                variant={cabinet.variantId ? props.variantModels?.[cabinet.variantId] : undefined}
                open={Boolean(props.open && selectedId === cabinet.id)} />
              {(selectedId === cabinet.id || invalid.has(cabinet.id)) && (
                <mesh
                  userData={{ exportExclude: true }}
                  raycast={() => {}}
                  position={[0, cabinet.height / 2000, 0]}
                >
                  <boxGeometry
                    args={[
                      cabinet.width / 1000 + 0.003,
                      cabinet.height / 1000 + 0.003,
                      cabinet.depth / 1000 + 0.003,
                    ]}
                  />
                  <meshBasicMaterial
                    transparent
                    opacity={0}
                    colorWrite={false}
                    depthWrite={false}
                  />
                  <Edges
                    color={invalid.has(cabinet.id) ? "#d62828" : "#0078d4"}
                    linewidth={2}
                    raycast={() => {}}
                  />
                </mesh>
              )}
            </group>
          );
        })}
        <KitchenTops kitchen={kitchen} materialDefinitions={props.materialDefinitions}
          onSelectCountertop={top => props.onSelectCountertop?.(top.id)}
          onCountertopPointerDown={(event, top) => start(event, top)}
          selectedId={props.selectedId}
          catalogApplianceIds={kitchen.cabinets.filter(c => !c.catalogAdaptation && props.variantModels?.[c.variantId ?? ""]?.glbFile && kitchenVariantMatchesRole(props.variantModels[c.variantId ?? ""], c)).map(c => c.id)} />
        {(kitchen.extras ?? []).map((extra) => (
          <group
            key={extra.id}
            name={`Extra-${extra.id}`}
            position={[
              extra.position.x / 1000,
              extra.position.y / 1000,
              extra.position.z / 1000,
            ]}
            rotation={[0, extra.position.rotation, 0]}
            onPointerDown={(event) => start(event, extra)}
            onPointerMove={move}
            onPointerUp={(event) => {
              if (drag.current?.pointerId === event.pointerId) {
                event.stopPropagation();
                finish(false);
              }
            }}
            onPointerCancel={(event) => {
              if (drag.current?.pointerId === event.pointerId) finish(true);
            }}
          >
            <KitchenExtraMesh
              extra={extra}
              selected={selectedId === extra.id}
            />
          </group>
        ))}
      </group>
      {props.contactShadows && (
        <RoomContactShadows
          updatingLayout={dragActive || Boolean(props.open)}
          position={[width / 2, 0.003, depth / 2]}
          opacity={0.42}
          scale={Math.max(width, depth) * 1.15}
          resolution={512}
          blur={2.2}
          far={1.1}
          color="#4b4640"
        />
      )}
    </CameraMotionPreview>
  );
}
class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p className="kp-viewer-message" role="status">
        3D дүрслэл ачаалагдсангүй. Байрлалыг доорх зураг болон хэмжээгээр
        тохируулж болно.
      </p>
    ) : (
      this.props.children
    );
  }
}
export function ModularKitchenScene(props: ModularSceneProps) {
  const performance = useCanvasPerformance();
  return (
    <SceneBoundary>
      <Canvas
        shadows={performance.shadows}
        dpr={performance.dpr}
        frameloop="demand"
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance", preserveDrawingBuffer: true }}
        onCreated={({ gl }) => {
          gl.setClearAlpha(0);
          configurePlannerRenderer(gl);
        }}
        camera={{ position: [4, 5, 6], fov: PLANNER_CAMERA.fov }}
        onPointerMissed={() => props.onDeselect?.()}
        fallback={
          <p className="kp-viewer-message">
            3D дэмжигдэхгүй байна. Доорх зураг, хэмжээсийг ашиглана уу.
          </p>
        }
      >
        <Scene {...props} dpr={performance.dpr} contactShadows={performance.contactShadows} />
      </Canvas>
    </SceneBoundary>
  );
}
