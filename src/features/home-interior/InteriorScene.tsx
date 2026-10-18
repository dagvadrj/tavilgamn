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
import { SceneHtml } from "@/three/SceneHtml";
import { InteriorHotspot } from "./InteriorHotspot";
import { useRoomMaterials, type RoomMaterials } from "./roomMaterials";
import {
  HeroBackWall,
  HeroWindow,
  TimberMediaWall,
  WindowDaylight,
} from "./HeroRoomFeatures";
import {
  LOWER_ROOM_Y,
  SOFA_GROUND_Y,
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
      <TimberMediaWall materials={materials} />
      <Vase position={[2.8, 0.83, -2.8]} color="#ece8df" />
      <Block
        position={[0.2, 0.85, -2.8]}
        size={[0.43, 0.06, 0.3]}
        color="#f0ebe2"
      />
      <Block
        position={[0.2, 0.91, -2.8]}
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
  const wall = theme.wall;
  const floor = theme.floor;
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
          color={floor}
          map={materials.wood}
          normalMap={materials.woodNormal}
          normalScale={new THREE.Vector2(0.35, 0.35)}
          roughnessMap={materials.woodRoughness}
          roughness={0.58}
        />
      </mesh>
      <HeroBackWall color={wall} bump={materials.plaster} />
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
      <HeroWindow />
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
      {[-1.05, 1.05].flatMap((x) =>
        [-0.38, 0.38].map((z) => (
          <mesh key={`${x}:${z}`} position={[x, 0.06, z]} castShadow>
            <cylinderGeometry args={[0.035, 0.025, 0.12, 8]} />
            <meshStandardMaterial color="#4a4038" roughness={0.65} />
          </mesh>
        )),
      )}
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
  const url = model ? `/api/models/files/${model.id}/${model.file}` : "";
  useEffect(() => {
    if (!url) {
      onStatus("preview");
      return;
    }
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

function SofaContactShadow({
  y,
  sofa,
}: {
  y: number;
  sofa: RefObject<THREE.Group | null>;
}) {
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const texture = useMemo(() => {
    const size = 64,
      data = new Uint8Array(size * size * 4);
    for (let row = 0; row < size; row++)
      for (let column = 0; column < size; column++) {
        const radius = Math.hypot(
          ((column + 0.5) / size) * 2 - 1,
          ((row + 0.5) / size) * 2 - 1,
        );
        data[(row * size + column) * 4 + 3] =
          Math.max(
            0,
            (Math.exp(-radius * radius * 3) - Math.exp(-3)) /
              (1 - Math.exp(-3)),
          ) * 255;
      }
    const result = new THREE.DataTexture(data, size, size);
    result.magFilter = THREE.LinearFilter;
    result.needsUpdate = true;
    return result;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  useFrame(() => {
    if (material.current && sofa.current)
      material.current.opacity =
        0.3 *
        Math.max(
          0,
          1 - Math.abs(sofa.current.position.y - y - SOFA_GROUND_Y) / 0.9,
        );
  });
  return (
    <mesh
      position={[0, y + SOFA_GROUND_Y - 0.006, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      raycast={() => {}}
    >
      <planeGeometry args={[3.2, 1.9]} />
      <meshBasicMaterial
        ref={material}
        map={texture}
        transparent
        opacity={0}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function Scene({ motion, theme, product, reduced, onStatus }: SceneProps) {
  const sofa = useRef<THREE.Group>(null);
  const hotspots = useRef<THREE.Group>(null);
  const { camera, invalidate, size } = useThree();
  const materials = useRoomMaterials();
  const target = useMemo(() => new THREE.Vector3(), []);
  const eye = useMemo(() => new THREE.Vector3(), []);
  const desiredTarget = useMemo(() => new THREE.Vector3(), []);
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
    if (hotspots.current) {
      hotspots.current.position.y = pose.cameraY;
      hotspots.current.visible =
        (pose.phase === 0 || pose.landed) && state.swap < 0;
    }
    const mobile = size.width < 768;
    const parallax = reduced || pose.landed ? 0 : 0.32;
    eye.set(
      mobile ? 4.2 : 3.2,
      pose.cameraY + (mobile ? 3.1 : 2.45) + state.pointer.y * parallax,
      mobile ? 10.2 : 7.8,
    );
    eye.x += state.pointer.x * parallax;
    const blend = snap ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 7);
    camera.position.lerp(eye, blend);
    desiredTarget.set(
      mobile ? 0 : -1.65 + Math.min(1, progress / 0.7) * 2.5,
      pose.cameraY + (mobile ? 2.1 - Math.min(1, progress / 0.7) * 0.8 : 1.45),
      -0.35,
    );
    target.lerp(desiredTarget, blend);
    camera.lookAt(target);
    initialized.current = true;
    if (
      state.visible &&
      !reduced &&
      (Math.abs(renderedProgress.current - state.progress) > 0.0001 ||
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
      <hemisphereLight args={["#e9f1fa", "#a58c72", 0.95]} />
      <directionalLight position={[2, 5, 6]} intensity={0.7} color="#fff5e6" />
      <WindowDaylight y={0} />
      <WindowDaylight y={LOWER_ROOM_Y} />
      <Room y={0} theme={theme} materials={materials} upper />
      <Room y={LOWER_ROOM_Y} theme={theme} materials={materials} />
      <SofaContactShadow y={0} sofa={sofa} />
      <SofaContactShadow y={LOWER_ROOM_Y} sofa={sofa} />
      <group ref={sofa}>
        <SofaAsset product={product} color={theme.sofa} onStatus={onStatus} />
      </group>
      <group ref={hotspots}>
        <SceneHtml position={[0.95, 0.85, 0.65]} center zIndexRange={[8, 5]}>
          <InteriorHotspot
            title={product?.name ?? "Буйдан"}
            detail={
              product && product.basePrice > 0
                ? `${product.basePrice.toLocaleString("mn-MN")} ₮-өөс`
                : "Өрөөндөө тохирох буйдангаа олоорой"
            }
            href={product ? `/product/${product.id}` : "/catalog?category=sofa"}
          />
        </SceneHtml>
        <SceneHtml position={[0.8, 0.5, 2.14]} center zIndexRange={[8, 5]}>
          <InteriorHotspot
            title="Кофены ширээ"
            detail="Зохиомжийн санаа · Каталогоос сонгох"
            href="/catalog?category=coffee-table"
            linkLabel="Ширээнүүдийг үзэх"
          />
        </SceneHtml>
        <SceneHtml position={[2.6, 1.9, -0.8]} center zIndexRange={[8, 5]}>
          <InteriorHotspot
            title="Дулаан гэрэлтүүлэг"
            detail="Зохиомжийн санаа · Каталогоос хайх"
            href="/catalog?q=%D0%B3%D1%8D%D1%80%D1%8D%D0%BB"
            linkLabel="Гэрэлтүүлэг хайх"
          />
        </SceneHtml>
      </group>
    </>
  );
}

type SceneProps = {
  motion: RefObject<StoryMotion>;
  theme: InteriorStyle;
  product?: Product;
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
