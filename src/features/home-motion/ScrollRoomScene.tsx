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
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import type { Product } from "@/lib/types";
import { PremiumRoomSet } from "./PremiumRoomSet";
import { usePremiumRoomMaterials } from "./premiumRoomMaterials";
import { roomPixelRatio, roomStageMask } from "./roomRenderBudget";
import {
  ROOM_GAP,
  scrollRoomPose,
  roomFocusPose,
  ROOM_ITEMS,
  type RoomMotion,
  type RoomFurniture,
} from "./scrollRoomStory";
RectAreaLightUniformsLib.init();
type Props = {
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
function Room(props: Props) {
  const { motion, reduced, onReady, onError } = props;
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const size = useThree((s) => s.size);
  const setDpr = useThree((s) => s.setDpr);
  const compact =
    size.width < 768 || size.height < 520 || size.width / size.height < 0.85;
  const constrained = useMemo(() => {
    const memory = (navigator as Navigator & { deviceMemory?: number })
      .deviceMemory;
    return (
      (memory !== undefined && memory <= 4) ||
      navigator.hardwareConcurrency <= 4
    );
  }, []);
  const materials = usePremiumRoomMaterials();
  const [roomMask, setRoomMask] = useState(() =>
    compact
      ? 1 << scrollRoomPose(motion.current.progress).phase
      : roomStageMask(scrollRoomPose(motion.current.progress).travel),
  );
  const currentMask = useRef(roomMask);
  const cameraPhase = useRef<number | null>(null);
  const transitionOpacity = useRef(1);
  const viewShift = useRef(0);
  const viewShiftX = useRef(0);
  const surface = useRef<HTMLElement | null>(null);
  const groups = useRef<(THREE.Group | null)[]>([]),
    sun = useRef<THREE.DirectionalLight>(null);
  const aim = useMemo(() => new THREE.Object3D(), []),
    target = useMemo(() => new THREE.Vector3(), []),
    desiredEye = useMemo(() => new THREE.Vector3(), []),
    desiredTarget = useMemo(() => new THREE.Vector3(), []);
  const progress = useRef<number | null>(null);
  const initialized = useRef(false);
  const shadowTravel = useRef<number | null>(null);
  useEffect(() => {
    invalidate();
  }, [props.selected, invalidate]);
  useEffect(() => {
    const state = motion.current;
    state.invalidate = invalidate;
    const lost = (e: Event) => {
      e.preventDefault();
      onError();
    };
    gl.domElement.addEventListener("webglcontextlost", lost);
    invalidate();
    onReady();
    return () => {
      state.invalidate = undefined;
      gl.domElement.removeEventListener("webglcontextlost", lost);
    };
  }, [gl, invalidate, motion, onReady, onError]);
  useEffect(() => {
    const c = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    c.fov = compact
      ? aspect < 0.55
        ? 66
        : aspect < 1
          ? 62
          : 48
      : aspect < 1.4
        ? Math.min(
            72,
            (2 *
              Math.atan((Math.tan((21 * Math.PI) / 180) * 1.6) / aspect) *
              180) /
              Math.PI,
          )
        : 42;
    c.filmOffset = 0;
    c.clearViewOffset();
    initialized.current = false;
    c.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, compact, invalidate]);
  useFrame((_, delta) => {
    const state = motion.current;
    if (!state.visible || document.hidden) return;
    const destination =
      state.paused && progress.current !== null
        ? progress.current
        : state.progress;
    const p =
      reduced || state.snap || progress.current === null
        ? destination
        : THREE.MathUtils.damp(
            progress.current,
            destination,
            6,
            Math.min(delta, 0.25),
          );
    state.snap = false;
    progress.current = Math.abs(p - destination) < 0.0001 ? destination : p;
    const pose = scrollRoomPose(progress.current, compact);
    const nextMask = compact ? 1 << pose.phase : roomStageMask(pose.travel);
    if (nextMask !== currentMask.current) {
      currentMask.current = nextMask;
      setRoomMask(nextMask);
    }
    gl.domElement.dataset.roomTravel = pose.travel.toFixed(3);
    const focus =
      props.selected && ROOM_ITEMS[props.selected].room === pose.phase
        ? roomFocusPose(props.selected, pose.rotations[pose.phase], compact)
        : pose;
    desiredEye.fromArray(focus.eye);
    desiredTarget.fromArray(focus.target);
    // Reframe within the next room, with a brief fade, rather than crossing walls.
    if (compact && cameraPhase.current !== pose.phase) {
      if (cameraPhase.current !== null && !reduced)
        transitionOpacity.current = 0.15;
      initialized.current = false;
    }
    cameraPhase.current = pose.phase;
    const alpha =
      reduced || !initialized.current
        ? 1
        : 1 - Math.exp(-5 * Math.min(delta, 0.25));
    camera.position.lerp(desiredEye, alpha);
    target.lerp(desiredTarget, alpha);
    initialized.current = true;
    transitionOpacity.current = reduced
      ? 1
      : THREE.MathUtils.damp(
          transitionOpacity.current,
          1,
          8,
          Math.min(delta, 0.25),
        );
    if (transitionOpacity.current > 0.998) transitionOpacity.current = 1;
    const landscapeFocus =
      compact && size.width > size.height && !!props.selected;
    const desiredShift = compact
      ? landscapeFocus
        ? -0.12
        : props.selected
          ? 0.12
          : 0.045
      : 0;
    const desiredShiftX = landscapeFocus ? 0.15 : 0;
    viewShift.current = THREE.MathUtils.lerp(
      viewShift.current,
      desiredShift,
      alpha,
    );
    if (Math.abs(viewShift.current - desiredShift) < 0.0001)
      viewShift.current = desiredShift;
    viewShiftX.current = THREE.MathUtils.lerp(
      viewShiftX.current,
      desiredShiftX,
      alpha,
    );
    if (Math.abs(viewShiftX.current - desiredShiftX) < 0.0001)
      viewShiftX.current = desiredShiftX;
    (camera as THREE.PerspectiveCamera).setViewOffset(
      size.width,
      size.height,
      size.width * viewShiftX.current,
      size.height * viewShift.current,
      size.width,
      size.height,
    );
    const cameraMoving =
      camera.position.distanceToSquared(desiredEye) > 0.000001 ||
      target.distanceToSquared(desiredTarget) > 0.000001 ||
      viewShift.current !== desiredShift ||
      viewShiftX.current !== desiredShiftX ||
      transitionOpacity.current !== 1;
    const moving = cameraMoving || progress.current !== destination;
    const dpr = roomPixelRatio(
      size.width,
      size.height,
      window.devicePixelRatio,
      moving,
      constrained || size.width < 768,
    );
    if (Math.abs(gl.getPixelRatio() - dpr) > 0.01) setDpr(dpr);
    if (!cameraMoving) {
      camera.position.copy(desiredEye);
      target.copy(desiredTarget);
    }
    camera.lookAt(target);
    if (!surface.current)
      surface.current = gl.domElement.closest(".scroll-room-scene");
    surface.current?.style.setProperty(
      "--room-scene-opacity",
      String(transitionOpacity.current),
    );
    gl.domElement.dataset.compact = String(compact);
    gl.domElement.dataset.roomOpacity = transitionOpacity.current.toFixed(3);
    gl.domElement.dataset.roomSettled = String(
      progress.current === destination && !cameraMoving,
    );
    gl.domElement.dataset.roomFocus = props.selected || "";
    gl.domElement.dataset.cameraPosition = camera.position
      .toArray()
      .map((n) => n.toFixed(3))
      .join(",");
    gl.domElement.dataset.renderFrame = String(gl.info.render.frame);
    gl.domElement.dataset.drawCalls = String(gl.info.render.calls);
    gl.domElement.dataset.triangles = String(gl.info.render.triangles);
    gl.domElement.dataset.geometries = String(gl.info.memory.geometries);
    gl.domElement.dataset.textures = String(gl.info.memory.textures);
    gl.domElement.dataset.roomCount = String(
      [0, 1, 2].filter((i) => roomMask & (1 << i)).length,
    );
    groups.current.forEach((g, i) => {
      if (g) {
        g.rotation.y = pose.rotations[i];
        g.visible = Boolean(nextMask & (1 << i));
      }
    });
    if (sun.current) {
      const lightRoom = compact ? pose.phase : pose.travel;
      sun.current.position.set(lightRoom * ROOM_GAP + 5, 6, 3);
      aim.position.set(lightRoom * ROOM_GAP, 0, -2);
      aim.updateMatrixWorld();
    }
    if (shadowTravel.current !== pose.travel) {
      gl.shadowMap.needsUpdate = true;
      shadowTravel.current = pose.travel;
    }
    if (
      !reduced &&
      (cameraMoving || (!state.paused && progress.current !== destination))
    )
      invalidate();
  });
  return (
    <>
      <color attach="background" args={["#242019"]} />
      <Environment
        files="/interior/daylight-1k.hdr"
        environmentIntensity={0.3}
      />
      <ambientLight intensity={0.13} color="#dac7af" />
      <hemisphereLight args={["#d6e0ec", "#372b20", 0.3]} />
      <primitive object={aim} />
      <directionalLight
        ref={sun}
        target={aim}
        position={[5, 6, 3]}
        color="#fff0d4"
        intensity={2.4}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-camera-near={0.5}
        shadow-camera-far={25}
        shadow-normalBias={0.035}
        shadow-bias={-0.00015}
      />
      {[0, 1, 2]
        .filter((i) => roomMask & (1 << i))
        .map((i) => (
          <group
            key={i}
            ref={(g) => {
              groups.current[i] = g;
            }}
            position={[i * ROOM_GAP, 0, 0]}
            visible={i === props.phase}
          >
            <Suspense fallback={null}>
              <PremiumRoomSet
                {...props}
                index={i}
                active={i === props.phase}
                materials={materials}
              />
            </Suspense>
          </group>
        ))}
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
export default function ScrollRoomScene(props: Props) {
  return (
    <Boundary onError={props.onError}>
      <Canvas
        frameloop="demand"
        shadows
        dpr={1}
        camera={{ position: [0.25, 1.85, 4.7], fov: 42, near: 0.1, far: 70 }}
        gl={{ antialias: true, alpha: false, powerPreference: "low-power" }}
        fallback={<span>Таны хөтөч 3D дүрслэлийг дэмжихгүй байна.</span>}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.95;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          gl.shadowMap.autoUpdate = false;
          gl.shadowMap.needsUpdate = true;
        }}
      >
        <Suspense fallback={null}>
          <Room {...props} />
        </Suspense>
      </Canvas>
    </Boundary>
  );
}
