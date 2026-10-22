"use client";

import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Canvas,
  useFrame,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import { Edges, OrbitControls } from "@react-three/drei";
import { useCanvasPerformance } from "./canvasPerformance";
import { CameraMotionPreview } from "./CameraMotionPreview";
import { RoomMotionResolution } from "./RoomMotionQuality";
import { CanvasDiagnostics } from "./CanvasDiagnostics";
import {
  Plane,
  Shape,
  Vector3,
  PCFSoftShadowMap,
  type BufferGeometry,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
  type PerspectiveCamera,
} from "three";
import {
  roomWalls,
  type CabinetPose,
  type KitchenWall,
  type KitchenRoom,
  type ModularCabinet,
  type ModularKitchen,
} from "@/lib/kitchenCabinets";
import { placementIssues } from "@/lib/kitchenPlacement";
import { roomOutline } from "@/lib/kitchenRoomOutline";
import { kitchenEnvelope } from "@/lib/kitchenAssembly";
import { kitchenVariantMatchesRole, type KitchenCatalogVariant } from "@/lib/kitchenModuleCatalog";
import { KitchenTops } from "./KitchenTops";
import { KitchenCabinetGLB } from "./KitchenCabinetGLB";
import type { KitchenMaterialDefinition } from "@/lib/kitchenMaterials";
import { DEFAULT_FLOOR_MATERIAL } from "@/lib/roomDesign";
import { useRoomMaterial } from "./roomMaterials";
import { KitchenExtraMesh } from "./KitchenExtraMesh";
import { CameraNavigation } from "./CameraNavigation";
import { KitchenInteriorView } from "./KitchenInteriorView";
import { kitchenWallPanels } from "@/lib/kitchenWallPanels";
import type { CameraRequest } from "@/lib/plannerCamera";
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
  onDeselect?: () => void;
  onStart: (id: string) => void;
  onMove: (id: string, pose: CabinetPose) => void;
  onEnd: () => void;
  onCancel: () => void;
  variantModels?: Record<string, KitchenCatalogVariant>;
  materialDefinitions?: Record<string, KitchenMaterialDefinition>;
}
function CameraFit({ focus }: { focus: ReturnType<typeof kitchenEnvelope> }) {
  const { camera, size } = useThree();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current) return;
    fitted.current = true;
    const perspective = camera as PerspectiveCamera;
    perspective.fov = 45;
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
      .add(new Vector3(0.5, 0.85, 1).normalize().multiplyScalar(distance));
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }, [camera, focus, size.width, size.height]);
  return null;
}
function KitchenRoomWall({
  wall,
  room,
}: {
  wall: KitchenWall;
  room: KitchenRoom;
}) {
  const group = useRef<Group>(null);
  const x = (wall.start.x + wall.end.x) / 2000;
  const z = (wall.start.z + wall.end.z) / 2000;
  const { solids, openings } = kitchenWallPanels(wall, room);
  useFrame(({ camera }) => {
    if (!group.current) return;
    const outside =
      (camera.position.x - x) * wall.inward.x +
        (camera.position.z - z) * wall.inward.z <
      -0.06;
    group.current.traverse((object) => {
      if (object.type !== "Mesh") return;
      const mesh = object as Mesh<BufferGeometry, MeshStandardMaterial>;
      mesh.material.opacity =
        (outside ? 0.065 : 1) * (mesh.userData.surfaceOpacity ?? 1);
      mesh.material.depthWrite = !outside && !mesh.userData.surfaceOpacity;
      mesh.castShadow = !outside && !mesh.userData.surfaceOpacity;
    });
  });
  return (
    <group
      ref={group}
      position={[x - wall.inward.x * 0.06, 0, z - wall.inward.z * 0.06]}
      rotation={[0, Math.atan2(wall.inward.x, wall.inward.z), 0]}
    >
      {solids.map((panel, index) => (
        <mesh
          key={index}
          position={[panel.x, panel.y, 0]}
          raycast={() => {}}
          receiveShadow
          castShadow
        >
          <boxGeometry args={[panel.width, panel.height, 0.12]} />
          <meshStandardMaterial
            color={
              room.wallColors?.[
                (wall.sourceWall ?? wall.id) as keyof NonNullable<
                  KitchenRoom["wallColors"]
                >
              ] ?? "#f1eee8"
            }
            roughness={0.92}
            transparent
          />
        </mesh>
      ))}
      {openings.map((opening) => (
        <group key={opening.id}>
          {opening.kind === "window" && (
            <mesh
              position={[opening.x, (opening.bottom + opening.top) / 2, 0]}
              raycast={() => {}}
              userData={{ surfaceOpacity: 0.25 }}
            >
              <boxGeometry
                args={[opening.width, opening.top - opening.bottom, 0.015]}
              />
              <meshStandardMaterial
                color="#b8dcee"
                transparent
                opacity={0.25}
                roughness={0.1}
              />
            </mesh>
          )}
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              position={[
                opening.x + (side * opening.width) / 2,
                (opening.bottom + opening.top) / 2,
                0,
              ]}
              raycast={() => {}}
            >
              <boxGeometry args={[0.035, opening.top - opening.bottom, 0.15]} />
              <meshStandardMaterial color="#ffffff" transparent />
            </mesh>
          ))}
          {[opening.bottom, opening.top]
            .filter((y) => y > 0)
            .map((y) => (
              <mesh key={y} position={[opening.x, y, 0]} raycast={() => {}}>
                <boxGeometry args={[opening.width, 0.035, 0.15]} />
                <meshStandardMaterial color="#ffffff" transparent />
              </mesh>
            ))}
        </group>
      ))}
    </group>
  );
}
type CaptureTarget = {
  setPointerCapture: (id: number) => void;
  releasePointerCapture: (id: number) => void;
};
function Scene(props: ModularSceneProps) {
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
  const floorShape = useMemo(() => {
    const shape = new Shape();
    roomOutline(kitchen.room).forEach((p, i, points) => {
      if (i === 0) shape.moveTo(p.x / 1000, -p.z / 1000);
      const q = points[(i + 1) % points.length];
      if (p.curve)
        shape.quadraticCurveTo(
          p.curve.x / 1000,
          -p.curve.z / 1000,
          q.x / 1000,
          -q.z / 1000,
        );
      else shape.lineTo(q.x / 1000, -q.z / 1000);
    });
    shape.closePath();
    return shape;
  }, [kitchen.room]);
  const roomHeight = kitchen.room.height / 1000;
  const cameraTarget = props.cameraRequest?.targetId
    ? kitchen.cabinets.find((cabinet) => cabinet.id === props.cameraRequest?.targetId)
    : undefined;
  const floorMaterial = useRoomMaterial(
    DEFAULT_FLOOR_MATERIAL,
    width,
    depth,
    "#c9a37a",
  );
  return (
    <>
      {!props.interior && <CameraFit focus={focus} />}
      <color attach="background" args={["#f3f4f6"]} />
      <ambientLight intensity={0.5} />
      <hemisphereLight args={["#f7f9ff", "#b9a991", 0.85]} />
      <directionalLight position={[-3, 4, -2]} intensity={0.45} color="#dfe9ff" />
      <directionalLight
        castShadow
        position={[2, 7, 4]}
        intensity={1.8}
        color="#fff4e6"
        shadow-radius={4}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-normalBias={0.025}
        shadow-bias={-0.0001}
      />
      {!props.interior && (
        <OrbitControls
          makeDefault
          enabled={!dragActive}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.65}
          zoomSpeed={0.8}
          enablePan
          screenSpacePanning
          zoomToCursor
          target={[focus.centerX / 1000, focus.h / 2, focus.centerZ / 1000]}
          minDistance={1}
          maxDistance={Math.max(18, Math.hypot(width, depth, roomHeight) * 4)}
          maxPolarAngle={Math.PI / 2.05}
        />
      )}
      {!props.interior && (
        <CameraNavigation
          leftDrag
          request={props.cameraRequest}
          bounds={cameraTarget ? {
            width: cameraTarget.width / 1000,
            depth: cameraTarget.depth / 1000,
            height: cameraTarget.height / 1000,
            centerX: cameraTarget.position.x / 1000,
            centerZ: cameraTarget.position.z / 1000,
            centerY: (cameraTarget.position.y + cameraTarget.height / 2) / 1000,
          } : {
            width,
            depth,
            height: roomHeight,
            centerX: width / 2,
            centerZ: depth / 2,
          }}
        />
      )}
      {!props.interior && <CursorNavigation />}
      {props.interior && (
        <KitchenInteriorView kitchen={kitchen} request={props.cameraRequest} />
      )}
      {kitchen.room.outline ? (
        <mesh
          position={[0, -0.08, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <extrudeGeometry
            args={[
              floorShape,
              { depth: 0.08, bevelEnabled: false, curveSegments: 64 },
            ]}
          />
          <meshStandardMaterial {...floorMaterial} />
        </mesh>
      ) : (
        <mesh position={[width / 2, -0.04, depth / 2]} receiveShadow>
          <boxGeometry args={[width, 0.08, depth]} />
          <meshStandardMaterial {...floorMaterial} />
        </mesh>
      )}
      {roomWalls(kitchen.room).map((wall) => (
        <KitchenRoomWall key={wall.id} wall={wall} room={kitchen.room} />
      ))}
      {(kitchen.room.items ?? [])
        .filter((item) => item.kind === "column")
        .map((item) => (
          <mesh
            key={item.id}
            position={[item.x / 1000, roomHeight / 2, item.z / 1000]}
            castShadow
            receiveShadow
          >
            <boxGeometry
              args={[item.width / 1000, roomHeight, item.depth / 1000]}
            />
            <meshStandardMaterial color="#dedfd9" />
          </mesh>
        ))}
      <group
        ref={props.exportRoot}
        name="Kitchen"
        userData={{
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
              <KitchenCabinetGLB cabinet={cabinet} selected={selectedId === cabinet.id}
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
          catalogApplianceIds={kitchen.cabinets.filter(c => props.variantModels?.[c.variantId ?? ""]?.glbFile && kitchenVariantMatchesRole(props.variantModels[c.variantId ?? ""], c)).map(c => c.id)} />
        {(kitchen.extras ?? []).map((extra) => (
          <group
            key={extra.id}
            name={`Extra-${extra.id}`}
            position={[extra.position.x / 1000, 0, extra.position.z / 1000]}
            rotation={[0, extra.position.rotation, 0]}
            onPointerDown={(event) => start(event, extra)}
          >
            <KitchenExtraMesh
              extra={extra}
              selected={selectedId === extra.id}
            />
          </group>
        ))}
      </group>
    </>
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
        gl={{ preserveDrawingBuffer: true }}
        onCreated={({ gl }) => { gl.shadowMap.type = PCFSoftShadowMap; }}
        camera={{ position: [4, 5, 6], fov: 45 }}
        onPointerMissed={() => props.onDeselect?.()}
        fallback={
          <p className="kp-viewer-message">
            3D дэмжигдэхгүй байна. Доорх зураг, хэмжээсийг ашиглана уу.
          </p>
        }
      >
        <CanvasDiagnostics scene="modular-kitchen" />
        <CameraMotionPreview>
          <RoomMotionResolution dpr={performance.dpr} />
          <Scene {...props} />
        </CameraMotionPreview>
      </Canvas>
    </SceneBoundary>
  );
}
