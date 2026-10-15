"use client";

import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import {
  acquireModel,
  cloneModel,
  disposeModelClone,
  type LoadedModel,
} from "@/three/modelLoader";
import type { Product } from "@/lib/types";
import { useRoomMaterials, type RoomMaterials } from "./roomMaterials";
import {
  LOWER_ROOM_Y,
  replacementHeight,
  storyPose,
  type InteriorStyle,
  type StoryMotion,
} from "./homeStory";

function Block({
  position,
  size,
  color,
  radius = 0.02,
  bump,
  map,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  radius?: number;
  bump?: THREE.Texture;
  map?: THREE.Texture;
}) {
  return (
    <RoundedBox
      args={size}
      position={position}
      radius={radius}
      smoothness={2}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        color={color}
        roughness={0.85}
        map={map}
        bumpMap={bump}
        bumpScale={0.012}
      />
    </RoundedBox>
  );
}

function Vase({
  position,
  color = "#b99b7b",
}: {
  position: [number, number, number];
  color?: string;
}) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.095, 0.13, 0.32, 20]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <group key={i} rotation={[0.14 * i, i * 2.1, 0.13 * (i - 1)]}>
          <mesh position={[0, 0.55, 0]}>
            <cylinderGeometry args={[0.006, 0.008, 0.7, 6]} />
            <meshStandardMaterial color="#5d6650" />
          </mesh>
          <mesh
            position={[0.07, 0.7, 0]}
            rotation={[0, 0, -0.7]}
            scale={[0.06, 0.19, 0.025]}
          >
            <sphereGeometry args={[1, 10, 8]} />
            <meshStandardMaterial color="#727f5b" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function RoomDetails({ materials }: { materials: RoomMaterials }) {
  return (
    <group>
      {/* A full ceiling and recessed light coves frame an interior, rather than a dollhouse. */}
      <mesh
        position={[0, 3.62, -0.1]}
        rotation={[Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[8.4, 6.4]} />
        <meshStandardMaterial
          color="#fafafa"
          side={THREE.DoubleSide}
          roughness={1}
        />
      </mesh>
      <Block
        position={[0, 3.48, -3.07]}
        size={[8.2, 0.22, 0.35]}
        color="#f5f4f0"
      />
      <Block
        position={[-3.91, 3.48, -0.1]}
        size={[0.35, 0.22, 6.3]}
        color="#f5f4f0"
      />
      <mesh position={[0, 3.57, -2.84]}>
        <boxGeometry args={[7.8, 0.025, 0.04]} />
        <meshStandardMaterial
          color="#fff5de"
          emissive="#fff2d3"
          emissiveIntensity={3}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[-3.69, 3.57, -0.1]}>
        <boxGeometry args={[0.04, 0.025, 5.9]} />
        <meshStandardMaterial
          color="#fff5de"
          emissive="#fff2d3"
          emissiveIntensity={3}
          toneMapped={false}
        />
      </mesh>
      {/* Tall bookcase along the side wall; individual books introduce real scale. */}
      <group position={[-3.7, 0, -0.55]} rotation={[0, Math.PI / 2, 0]}>
        <Block
          position={[0, 1.42, -0.2]}
          size={[2.1, 2.8, 0.07]}
          color="#34393c"
        />
        {[-1.04, 0, 1.04].map((x) => (
          <Block
            key={x}
            position={[x, 1.42, 0]}
            size={[0.055, 2.85, 0.46]}
            color="#42474a"
          />
        ))}
        {[0.12, 0.76, 1.4, 2.04, 2.83].map((height) => (
          <Block
            key={height}
            position={[0, height, 0]}
            size={[2.14, 0.055, 0.46]}
            color="#42474a"
          />
        ))}
        {[0.79, 1.43, 2.07].map((height, row) => (
          <group key={row}>
            {Array.from({ length: 9 }, (_, i) => (
              <Block
                key={i}
                position={[
                  -0.91 + i * 0.21,
                  height + (0.28 + ((i + row) % 3) * 0.06) / 2,
                  0.06,
                ]}
                size={[
                  0.065 + (i % 2) * 0.025,
                  0.28 + ((i + row) % 3) * 0.06,
                  0.27,
                ]}
                color={
                  ["#d5cbb6", "#8b948d", "#e9e3d7", "#9b8065", "#a8b2b9"][
                    (i + row) % 5
                  ]
                }
                radius={0.004}
              />
            ))}
          </group>
        ))}
        {[-0.53, 0.53].map((x) => (
          <Block
            key={x}
            position={[x, 0.4, 0]}
            size={[0.83, 0.48, 0.38]}
            color="#ad9d80"
            bump={materials.linen}
          />
        ))}
      </group>
      {/* Low oak storage, ceramic decor and brushed metal handles. */}
      <Block
        position={[2.65, 0.58, -2.65]}
        size={[2.05, 0.86, 0.66]}
        color="#bdac95"
        map={materials.wood}
      />
      {[2.12, 3.18].map((x) => (
        <group key={x}>
          <Block
            position={[x, 0.58, -2.305]}
            size={[0.99, 0.79, 0.035]}
            color="#d7c7af"
            map={materials.wood}
          />
          <Block
            position={[x, 0.78, -2.27]}
            size={[0.24, 0.018, 0.035]}
            color="#343638"
            radius={0.005}
          />
          <Block
            position={[x, 0.09, -2.65]}
            size={[0.07, 0.18, 0.48]}
            color="#343638"
          />
        </group>
      ))}
      <Vase position={[3.25, 1.03, -2.65]} color="#ece8df" />
      <Block
        position={[2.23, 1.06, -2.57]}
        size={[0.43, 0.06, 0.3]}
        color="#f0ebe2"
      />
      <Block
        position={[2.23, 1.12, -2.57]}
        size={[0.37, 0.05, 0.27]}
        color="#68777e"
      />
      <group position={[-2.7, 0, -2.2]} scale={1.7}>
        <Vase position={[0, 0, 0]} color="#d5d0c5" />
        {Array.from({ length: 7 }, (_, i) => (
          <group key={i} rotation={[0, i * 2.4, 0]}>
            <mesh
              position={[0.13, 0.62 + (i % 3) * 0.12, 0]}
              rotation={[0.1, 0, -0.6]}
              scale={[0.1, 0.28, 0.018]}
              castShadow
            >
              <sphereGeometry args={[1, 12, 10]} />
              <meshStandardMaterial
                color={i % 2 ? "#52654a" : "#74835b"}
                roughness={0.65}
              />
            </mesh>
          </group>
        ))}
      </group>
      {/* Pleated pendant above the side table, clear of the sofa's travel. */}
      <mesh position={[-2.2, 3.1, 0.15]}>
        <cylinderGeometry args={[0.009, 0.009, 1.05, 8]} />
        <meshStandardMaterial color="#5c5d58" />
      </mesh>
      <mesh position={[-2.2, 2.55, 0.15]} castShadow>
        <cylinderGeometry args={[0.18, 0.38, 0.45, 32, 1, true]} />
        <meshStandardMaterial
          color="#f5f1e7"
          side={THREE.DoubleSide}
          roughness={0.9}
          bumpMap={materials.linen}
          bumpScale={0.006}
          emissive="#ffe6bc"
          emissiveIntensity={0.12}
        />
      </mesh>
    </group>
  );
}

function Room({
  y,
  theme,
  upper = false,
  materials,
}: {
  y: number;
  theme: InteriorStyle;
  upper?: boolean;
  materials: RoomMaterials;
}) {
  const wall = upper ? "#deded9" : theme.wall;
  const floor = upper ? "#b8aa98" : theme.floor;
  return (
    <group position={[0, y, 0]}>
      <Block
        position={[0, -0.13, -0.1]}
        size={[8.4, 0.25, 6.4]}
        color={floor}
      />
      <mesh
        position={[0, 0.002, -0.1]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[8.4, 6.4]} />
        <meshStandardMaterial
          color={new THREE.Color(floor).lerp(new THREE.Color("#ffffff"), 0.65)}
          map={materials.wood}
          normalMap={materials.woodNormal}
          normalScale={new THREE.Vector2(0.35, 0.35)}
          roughnessMap={materials.woodRoughness}
          roughness={0.82}
        />
      </mesh>
      <Block
        position={[0, 1.8, -3.3]}
        size={[8.4, 3.6, 0.16]}
        color={wall}
        bump={materials.plaster}
      />
      <Block
        position={[-4.13, 1.8, -0.1]}
        size={[0.16, 3.6, 6.4]}
        color={wall}
        bump={materials.plaster}
      />
      <Block
        position={[0, 0.07, -3.18]}
        size={[8.2, 0.14, 0.07]}
        color={upper ? "#bdb9a9" : "#eee9df"}
      />
      <Block
        position={[-4.02, 0.07, -0.1]}
        size={[0.07, 0.14, 6.3]}
        color={upper ? "#bdb9a9" : "#eee9df"}
      />
      <Block
        position={[0.05, 0.026, 0.35]}
        size={[4.6, 0.04, 3.15]}
        color={upper ? "#d4cabc" : theme.rug}
        radius={0.018}
        bump={materials.linen}
      />
      {[-2.08, 2.18].map((x) => (
        <mesh
          key={x}
          position={[x, 0.05, 0.35]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.025, 2.95]} />
          <meshBasicMaterial color="#f5f0e5" transparent opacity={0.5} />
        </mesh>
      ))}
      {/* Deep window reveal, glazing, mullions and folded linen curtains. */}
      <Block
        position={[-2.65, 2.05, -3.17]}
        size={[2.1, 2.3, 0.22]}
        color="#f3ecdf"
      />
      <mesh position={[-2.65, 2.05, -3.045]}>
        <planeGeometry args={[1.88, 2.1]} />
        <meshStandardMaterial
          color={upper ? "#c0d1d0" : "#d7e5de"}
          emissive="#bfd5d4"
          emissiveIntensity={0.3}
          roughness={0.2}
        />
      </mesh>
      <Block
        position={[-2.65, 2.05, -3.005]}
        size={[0.055, 2.1, 0.08]}
        color="#faf5ea"
      />
      <Block
        position={[-2.65, 2.05, -3.005]}
        size={[1.9, 0.055, 0.08]}
        color="#faf5ea"
      />
      <Block
        position={[-2.65, 0.88, -2.95]}
        size={[2.3, 0.1, 0.45]}
        color="#e6dfd1"
      />
      {[-3.79, -1.54].map((x) => (
        <group key={x}>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[x + i * 0.075, 1.72, -2.91]} castShadow>
              <cylinderGeometry args={[0.06, 0.075, 3.3, 12]} />
              <meshStandardMaterial
                color="#f4f1e9"
                roughness={1}
                bumpMap={materials.linen}
                bumpScale={0.008}
              />
            </mesh>
          ))}
        </group>
      ))}
      {/* Layered abstract print in an oak frame. */}
      <Block
        position={[0.75, 2.35, -3.12]}
        size={[1.7, 1.9, 0.09]}
        color="#6f5842"
      />
      <Block
        position={[0.75, 2.35, -3.055]}
        size={[1.57, 1.77, 0.035]}
        color="#eee4d2"
      />
      <mesh position={[0.98, 2.6, -3.025]}>
        <circleGeometry args={[0.46, 48]} />
        <meshBasicMaterial color={theme.accent} />
      </mesh>
      <mesh position={[0.52, 2.04, -3.02]}>
        <planeGeometry args={[0.72, 0.58]} />
        <meshBasicMaterial color="#b78a62" />
      </mesh>
      <Block
        position={[2.35, 1.98, -3.12]}
        size={[0.85, 1.15, 0.07]}
        color="#74674e"
      />
      <Block
        position={[2.35, 1.98, -3.06]}
        size={[0.74, 1.04, 0.025]}
        color="#d4c6ac"
      />
      {/* Side table, books, ceramic vase and a warm reading lamp. */}
      <mesh position={[-2.2, 0.56, 0.15]} castShadow receiveShadow>
        <cylinderGeometry args={[0.48, 0.48, 0.1, 48]} />
        <meshStandardMaterial color="#6c523a" roughness={0.65} />
      </mesh>
      <mesh position={[-2.2, 0.28, 0.15]} castShadow>
        <cylinderGeometry args={[0.16, 0.22, 0.5, 32]} />
        <meshStandardMaterial color="#7c6146" />
      </mesh>
      <Block
        position={[-2.2, 0.65, 0.27]}
        size={[0.34, 0.065, 0.24]}
        color="#c5b797"
      />
      <Vase position={[-2.35, 0.62, -0.04]} />
      <mesh position={[2.6, 0.05, -0.8]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.08, 32]} />
        <meshStandardMaterial
          color="#4a493e"
          metalness={0.4}
          roughness={0.45}
        />
      </mesh>
      <mesh position={[2.6, 1.12, -0.8]} castShadow>
        <cylinderGeometry args={[0.024, 0.024, 2.1, 12]} />
        <meshStandardMaterial color="#6f6551" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[2.6, 2.12, -0.8]} castShadow>
        <cylinderGeometry args={[0.27, 0.48, 0.55, 40, 1, true]} />
        <meshStandardMaterial
          color="#efe2c5"
          side={THREE.DoubleSide}
          roughness={1}
          emissive="#f1d5a4"
          emissiveIntensity={0.18}
        />
      </mesh>
      <pointLight
        position={[2.6, 1.95, -0.8]}
        color="#ffe1ad"
        intensity={3}
        distance={4}
        decay={2}
      />
      <Vase position={[3.18, 0, 1.3]} color={theme.accent} />
      {/* Low foreground table adds a second depth plane without covering the sofa. */}
      <Block
        position={[0.25, 0.32, 2.14]}
        size={[1.65, 0.11, 0.65]}
        color="#735b43"
        radius={0.05}
      />
      {[-0.4, 0.9].map((x) => (
        <Block
          key={x}
          position={[x, 0.16, 2.14]}
          size={[0.12, 0.3, 0.48]}
          color="#735b43"
        />
      ))}
      <Block
        position={[0.5, 0.405, 2.14]}
        size={[0.4, 0.06, 0.28]}
        color={theme.accent}
      />
      <RoomDetails materials={materials} />
    </group>
  );
}

function PlaceholderSofa({ color }: { color: string }) {
  return (
    <group>
      <Block
        position={[0, 0.24, 0]}
        size={[2.7, 0.35, 1.02]}
        color={color}
        radius={0.1}
      />
      <Block
        position={[0, 0.65, -0.42]}
        size={[2.7, 0.7, 0.28]}
        color={color}
        radius={0.1}
      />
      {[-1.33, 1.33].map((x) => (
        <Block
          key={x}
          position={[x, 0.48, 0.02]}
          size={[0.3, 0.7, 1.12]}
          color={color}
          radius={0.1}
        />
      ))}
      {[-0.85, 0, 0.85].map((x) => (
        <Block
          key={x}
          position={[x, 0.46, 0.06]}
          size={[0.81, 0.2, 0.79]}
          color={color}
          radius={0.08}
        />
      ))}
    </group>
  );
}

function SofaAsset({
  product,
  color,
  onStatus,
}: {
  product?: Product;
  color: string;
  onStatus: (state: string) => void;
}) {
  const { gl, invalidate } = useThree();
  const [asset, setAsset] = useState<{
    model: LoadedModel;
    url: string;
  } | null>(null);
  const model = product?.model;
  const url = model
    ? `/api/models/files/${model.id}/${model.previewFile || model.file}`
    : "";
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    let owned: LoadedModel | undefined;
    onStatus("loading");
    const lease = acquireModel(gl, url);
    void lease.promise
      .then((result) => {
        if (cancelled) return;
        owned = cloneModel(result);
        setAsset({ model: owned, url });
        onStatus("ready");
        invalidate();
      })
      .catch(() => {
        if (!cancelled) {
          onStatus("error");
          setAsset(null);
        }
      });
    return () => {
      cancelled = true;
      if (owned) disposeModelClone(owned);
      lease.release();
    };
  }, [gl, url, invalidate, onStatus]);
  const placement = useMemo(() => {
    if (!asset) return null;
    const size = asset.model.bounds.getSize(new THREE.Vector3());
    const center = asset.model.bounds.getCenter(new THREE.Vector3());
    const scale = Math.min(2.9 / size.x, 1.85 / size.z, 1.5 / size.y);
    return {
      scale,
      position: [
        -center.x * scale,
        -asset.model.bounds.min.y * scale,
        -center.z * scale,
      ] as [number, number, number],
    };
  }, [asset]);
  if (!asset || asset.url !== url || !placement)
    return <PlaceholderSofa color={color} />;
  return (
    <group dispose={null}>
      <primitive
        object={asset.model.scene}
        scale={placement.scale}
        position={placement.position}
      />
    </group>
  );
}

function Scene({
  motion,
  theme,
  product,
  preloadProducts,
  reduced,
  onStatus,
}: SceneProps) {
  const sofa = useRef<THREE.Group>(null);
  const { camera, invalidate, size, gl } = useThree();
  const materials = useRoomMaterials();
  const target = useMemo(() => new THREE.Vector3(), []);
  const eye = useMemo(() => new THREE.Vector3(), []);
  const desiredTarget = useMemo(() => new THREE.Vector3(), []);
  const lowerLightTarget = useMemo(() => {
    const object = new THREE.Object3D();
    object.position.set(0, LOWER_ROOM_Y, 0);
    return object;
  }, []);
  const preloadKey = preloadProducts
    .map((item) =>
      item?.model
        ? `/api/models/files/${item.model.id}/${item.model.previewFile || item.model.file}`
        : "",
    )
    .filter(Boolean)
    .join("|");
  useEffect(() => {
    const leases = preloadKey
      .split("|")
      .filter(Boolean)
      .map((url) => acquireModel(gl, url));
    for (const lease of leases) void lease.promise.catch(() => {});
    return () => leases.forEach((lease) => lease.release());
  }, [gl, preloadKey]);
  const initialized = useRef(false);
  const renderedProgress = useRef(0);
  useEffect(() => {
    const state = motion.current;
    state.invalidate = invalidate;
    invalidate();
    return () => {
      state.invalidate = undefined;
    };
  }, [invalidate, motion]);
  useFrame(({ clock }, dt) => {
    const state = motion.current;
    const snap = reduced || !initialized.current || state.snap;
    renderedProgress.current = snap
      ? state.progress
      : THREE.MathUtils.damp(
          renderedProgress.current,
          state.progress,
          9,
          Math.min(dt, 0.1),
        );
    if (Math.abs(renderedProgress.current - state.progress) < 0.0001)
      renderedProgress.current = state.progress;
    state.snap = false;
    const progress = renderedProgress.current;
    const pose = storyPose(progress, clock.elapsedTime, reduced);
    if (sofa.current) {
      sofa.current.position.y = pose.sofaY + replacementHeight(state.swap);
      sofa.current.rotation.y = pose.rotation;
    }
    const mobile = size.width < 768;
    const parallax = reduced || pose.landed ? 0 : 0.32;
    eye.set(
      mobile ? 4.2 : 3.2,
      pose.cameraY + (mobile ? 3.1 : 2.45) + state.pointer.y * parallax,
      mobile ? 10.2 : 7.8,
    );
    eye.x += state.pointer.x * parallax;
    const blend = snap ? 1 : 1 - Math.exp(-dt * 7);
    camera.position.lerp(eye, blend);
    desiredTarget.set(
      mobile ? 0 : -1.25 + Math.min(1, progress / 0.7) * 2.1,
      pose.cameraY + (mobile ? 2.1 - Math.min(1, progress / 0.7) * 0.8 : 1.45),
      -0.35,
    );
    target.lerp(desiredTarget, blend);
    camera.lookAt(target);
    initialized.current = true;
    if (
      state.visible &&
      !reduced &&
      (!pose.landed ||
        state.swap >= 0 ||
        camera.position.distanceToSquared(eye) > 0.00001 ||
        target.distanceToSquared(desiredTarget) > 0.00001)
    )
      invalidate();
  });
  return (
    <>
      <color attach="background" args={["#ffffff"]} />
      <ambientLight intensity={0.35} />
      <hemisphereLight args={["#f5f9ff", "#8e8170", 0.85]} />
      <directionalLight
        position={[-3, 8, 5]}
        intensity={3}
        color="#fff2dc"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-far={30}
        shadow-normalBias={0.035}
      />
      <primitive object={lowerLightTarget} />
      <directionalLight
        target={lowerLightTarget}
        position={[-3, LOWER_ROOM_Y + 7, 5]}
        intensity={2.5}
        color="#fff8ed"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-camera-far={25}
        shadow-normalBias={0.035}
      />
      <Room y={0} theme={theme} materials={materials} upper />
      <Room y={LOWER_ROOM_Y} theme={theme} materials={materials} />
      <group ref={sofa}>
        <SofaAsset product={product} color={theme.sofa} onStatus={onStatus} />
      </group>
    </>
  );
}

type SceneProps = {
  motion: RefObject<StoryMotion>;
  theme: InteriorStyle;
  product?: Product;
  preloadProducts: (Product | undefined)[];
  reduced: boolean;
  onStatus: (state: string) => void;
};
class SceneBoundary extends Component<
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

function WebGLFallback({ onStatus }: { onStatus: (state: string) => void }) {
  useEffect(() => {
    onStatus("unsupported");
  }, [onStatus]);
  return null;
}

export default function InteriorScene(props: SceneProps) {
  return (
    <SceneBoundary onError={() => props.onStatus("unsupported")}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        frameloop="demand"
        camera={{ position: [3.2, 2.45, 7.8], fov: 46, near: 0.1, far: 60 }}
        gl={{ antialias: true, alpha: false, powerPreference: "low-power" }}
        fallback={<WebGLFallback onStatus={props.onStatus} />}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1;
        }}
      >
        <Scene {...props} />
      </Canvas>
    </SceneBoundary>
  );
}
