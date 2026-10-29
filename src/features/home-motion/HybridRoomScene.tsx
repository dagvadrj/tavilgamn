"use client";
import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import type { Product } from "@/lib/types";
import { SceneHtml } from "@/three/SceneHtml";
import {
  ROOM_ITEMS,
  type RoomFurniture,
  type RoomMotion,
} from "./scrollRoomStory";
import { HYBRID_ROOMS, hybridCrop, hybridZoom } from "./hybridRooms";
import { useHybridMaterials } from "./useHybridMaterials";
import { HybridFurniture } from "./HybridFurniture";

export type HybridSceneProps = {
  motion: RefObject<RoomMotion>;
  reduced: boolean;
  phase: number;
  selected: RoomFurniture | null;
  sofa?: Product;
  bed?: Product;
  wardrobe?: Product;
  colors: Partial<Record<RoomFurniture, string>>;
  onSelect: (item: RoomFurniture) => void;
  onReady: () => void;
  onError: () => void;
  onSofaStatus: (s: string) => void;
  onBedStatus: (s: string) => void;
  onWardrobeStatus: (s: string) => void;
};
function FurnitureStage(props: HybridSceneProps) {
  const { motion, onReady, onError } = props;
  const { camera, gl, invalidate, size, scene, setDpr, setFrameloop } =
    useThree();
  const materials = useHybridMaterials();
  const shadow = useLoader(
    THREE.TextureLoader,
    "/interior/hybrid/contact-shadow.png",
  );
  const groups = useRef<Record<string, THREE.Group | null>>({});
  const state = useRef({
    progress: props.motion.current.progress,
    focus: 0,
    // Furniture flying back after the detail view closes; back runs 1 → 0.
    returning: null as RoomFurniture | null,
    back: 0,
    initialized: false,
    phase: props.phase,
    opacity: 1,
  });
  const [renderedPhase, setRenderedPhase] = useState(props.phase);
  const [settling, setSettling] = useState(false);
  const aim = useMemo(() => new THREE.Vector3(), []);
  const eye = useMemo(() => new THREE.Vector3(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const surface = useRef<HTMLElement | null>(null);
  useEffect(() => {
    surface.current = gl.domElement.closest(".scroll-room-scene");
    const control = motion.current;
    control.invalidate = () => {
      if (control.visible) {
        setFrameloop("demand");
        invalidate();
      } else setFrameloop("never");
    };
    const lost = (e: Event) => {
      e.preventDefault();
      onError();
    };
    gl.domElement.addEventListener("webglcontextlost", lost);
    // Compile while the photo is already visible; shader work is not deferred to a click.
    let live = true;
    void gl
      .compileAsync(scene, camera)
      .then(() => {
        if (!live) return;
        // Upload fixed furniture buffers before the first room change. Only this
        // tiny offscreen preparation pass visits all rooms; visible frames do not.
        const target = new THREE.WebGLRenderTarget(32, 18);
        const previous = gl.getRenderTarget();
        const visibility = Object.values(groups.current)
          .filter((g): g is THREE.Group => !!g)
          .map((g) => [g, g.visible] as const);
        try {
          visibility.forEach(([g]) => {
            g.visible = true;
          });
          gl.setRenderTarget(target);
          gl.render(scene, camera);
        } finally {
          visibility.forEach(([g, visible]) => {
            g.visible = visible;
          });
          gl.setRenderTarget(previous);
          target.dispose();
        }
        onReady();
        invalidate();
      })
      .catch(onError);
    return () => {
      live = false;
      control.invalidate = undefined;
      gl.domElement.removeEventListener("webglcontextlost", lost);
    };
  }, [gl, scene, camera, invalidate, motion, onReady, onError, setFrameloop]);
  useEffect(() => {
    invalidate();
  }, [props.selected, props.phase, props.colors, size, invalidate]);
  useEffect(() => {
    if (props.selected) setSettling(true);
  }, [props.selected]);
  useEffect(() => {
    setDpr(
      Math.min(
        window.devicePixelRatio || 1,
        1.25,
        Math.sqrt(1_800_000 / (size.width * size.height)),
      ),
    );
  }, [size.width, size.height, setDpr]);
  useFrame((_, delta) => {
    const motion = props.motion.current;
    if (!motion.visible) {
      setFrameloop("never");
      return;
    }
    const s = state.current;
    let snap = props.reduced || motion.snap || !s.initialized;
    const step = snap ? 1 : 1 - Math.exp(-7 * Math.min(delta, 0.1));
    const switching = s.phase !== props.phase;
    if (switching) {
      s.opacity = snap ? 0 : Math.max(0, s.opacity - delta * 7);
      if (s.opacity === 0) {
        s.phase = props.phase;
        s.focus = 0;
        s.returning = null;
        s.back = 0;
        setSettling(false);
        setRenderedPhase(s.phase);
        snap = true;
      }
    } else s.opacity = Math.min(1, s.opacity + delta * 5);
    if (props.selected) {
      s.returning = props.selected;
      s.back = 0;
    } else if (s.returning && s.back === 0) {
      // Closing: the room view returns at once so the other furniture never
      // moves; only the opened piece flies back from the camera to its place.
      s.focus = 0;
      s.back = props.reduced ? 0.001 : 1;
      snap = true;
    }
    s.progress += (motion.progress - s.progress) * step;
    s.focus += ((props.selected ? 1 : 0) - s.focus) * step;
    if (s.back > 0) {
      s.back *= Math.exp(-4.5 * Math.min(delta, 0.1));
      if (s.back < 0.004) {
        s.back = 0;
        s.returning = null;
        setSettling(false);
      }
    }
    const room = HYBRID_ROOMS[s.phase] || HYBRID_ROOMS[0];
    const crop = hybridCrop(size.width, size.height, room);
    const zoom = hybridZoom(s.progress, s.phase);
    const anchor = room.furniture.find((f) => f.id === props.selected);
    eye.fromArray(room.camera.eye);
    target.fromArray(room.camera.target);
    if (anchor) {
      const [w, h, d] = anchor.size;
      const fraction = Math.min(
        ((crop.width / room.frame[0]) * room.frame[0]) / room.frame[1],
        crop.height / room.frame[1],
      );
      const distance =
        Math.max(w, h, d) /
        (2 *
          Math.tan(THREE.MathUtils.degToRad(room.camera.fov / 2)) *
          fraction *
          0.66);
      target.set(
        anchor.position[0],
        anchor.position[1] + h * 0.48,
        anchor.position[2],
      );
      eye
        .copy(target)
        .add(look.set(distance * 0.32, distance * 0.23, distance));
    }
    if (snap) {
      camera.position.copy(eye);
      aim.copy(target);
    } else {
      camera.position.lerp(eye, step);
      aim.lerp(target, step);
    }
    camera.lookAt(aim);
    const c = camera as THREE.PerspectiveCamera;
    const viewWidth = crop.width / zoom,
      viewHeight = crop.height / zoom;
    const roomX = crop.x + (crop.width - viewWidth) / 2;
    const roomY = crop.y + (crop.height - viewHeight) / 2;
    const focusX =
      (crop.fullWidth - viewWidth) / 2 +
      (size.width > 767 ? viewWidth * 0.12 : 0);
    const focusY =
      (crop.fullHeight - viewHeight) / 2 +
      (size.width < 768 ? viewHeight * 0.06 : 0);
    c.setViewOffset(
      crop.fullWidth,
      crop.fullHeight,
      THREE.MathUtils.lerp(roomX, focusX, s.focus),
      THREE.MathUtils.lerp(roomY, focusY, s.focus),
      viewWidth,
      viewHeight,
    );
    surface.current?.style.setProperty("--hybrid-zoom", String(zoom));
    surface.current?.style.setProperty(
      "--room-scene-opacity",
      String(s.opacity),
    );
    gl.domElement.style.pointerEvents = switching ? "none" : "auto";
    for (const definition of HYBRID_ROOMS)
      for (const f of definition.furniture) {
        const g = groups.current[f.id];
        if (g) {
          const flying = s.returning === f.id && s.back > 0;
          g.visible =
            definition === room && (!props.selected || props.selected === f.id);
          g.position.fromArray(f.position);
          if (flying) g.position.lerp(camera.position, 0.55 * s.back);
          g.rotation.y =
            f.yaw +
            (props.selected === f.id
              ? -0.2 * s.focus
              : flying
                ? -0.2 * s.back
                : 0);
        }
      }
    const moving =
      switching ||
      s.opacity < 1 ||
      Math.abs(motion.progress - s.progress) > 0.00005 ||
      Math.abs((props.selected ? 1 : 0) - s.focus) > 0.0001 ||
      s.back > 0 ||
      camera.position.distanceToSquared(eye) > 0.000001 ||
      aim.distanceToSquared(target) > 0.000001;
    Object.assign(gl.domElement.dataset, {
      renderFrame: String(gl.info.render.frame),
      drawCalls: String(gl.info.render.calls),
      triangles: String(gl.info.render.triangles),
      textures: String(gl.info.memory.textures),
      geometries: String(gl.info.memory.geometries),
      roomCount: "1",
      roomTravel: props.phase.toFixed(3),
      roomFocus: props.selected || "",
      roomSettled: String(!moving),
      cameraPosition: camera.position
        .toArray()
        .map((n) => n.toFixed(3))
        .join(","),
      hybrid: "true",
    });
    motion.snap = false;
    s.initialized = true;
    if (moving) invalidate();
  });
  return (
    <>
      <Environment
        files="/interior/daylight-1k.hdr"
        environmentIntensity={0.9}
      />
      {HYBRID_ROOMS.map((room, i) =>
        room.furniture.map((f) => (
          <group
            key={f.id}
            ref={(g) => {
              groups.current[f.id] = g;
            }}
            position={f.position}
            rotation={[0, f.yaw, 0]}
            visible={
              i === renderedPhase &&
              (!props.selected || props.selected === f.id)
            }
            onClick={(e) => {
              e.stopPropagation();
              props.onSelect(f.id);
            }}
          >
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
              <planeGeometry args={[f.size[0] * 1.2, f.size[2] * 1.2]} />
              <meshBasicMaterial
                map={shadow}
                transparent
                depthWrite={false}
                toneMapped={false}
                opacity={0.65}
              />
            </mesh>
            <HybridFurniture
              item={f.id}
              m={materials}
              color={props.colors[f.id]}
              product={
                f.id === "sofa"
                  ? props.sofa
                  : f.id === "bed"
                    ? props.bed
                    : props.wardrobe
              }
              onStatus={
                f.id === "sofa"
                  ? props.onSofaStatus
                  : f.id === "bed"
                    ? props.onBedStatus
                    : f.id === "wardrobe"
                      ? props.onWardrobeStatus
                      : undefined
              }
            />
            {i === renderedPhase &&
              renderedPhase === props.phase &&
              !props.selected &&
              !settling && (
                <SceneHtml center position={f.hotspot} zIndexRange={[5, 4]}>
                  <button
                    className="scroll-room-hotspot"
                    data-item={f.id}
                    aria-label={`${ROOM_ITEMS[f.id].label} · Дэлгэрэнгүй`}
                    onClick={() => props.onSelect(f.id)}
                  >
                    <i />
                    <span>{ROOM_ITEMS[f.id].label}</span>
                  </button>
                </SceneHtml>
              )}
          </group>
        )),
      )}
    </>
  );
}
class Boundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
export default function HybridRoomScene(props: HybridSceneProps) {
  return (
    <Boundary onError={props.onError}>
      <Canvas
        className="hybrid-canvas"
        frameloop="demand"
        dpr={1}
        camera={{ position: [0, 2.5, 7.8], fov: 42, near: 0.1, far: 70 }}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        fallback={<span>3D түр боломжгүй.</span>}
        onCreated={({ gl }) => {
          gl.setClearColor(0, 0);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1;
        }}
      >
        <Suspense fallback={null}>
          <FurnitureStage {...props} />
        </Suspense>
      </Canvas>
    </Boundary>
  );
}
