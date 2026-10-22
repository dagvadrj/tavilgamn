"use client";
import {
  Component,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Product } from "@/lib/types";
import { SceneHtml } from "@/three/SceneHtml";
import { CanvasDiagnostics } from "@/three/CanvasDiagnostics";
import { InteriorHotspot } from "./InteriorHotspot";
import { useRoomMaterials } from "./roomMaterials";
import { ApartmentRoom } from "./ApartmentRoom";
import {
  FurnitureProduct,
  InteriorBed,
  InteriorWardrobe,
  Upholstered,
} from "./JourneyFurniture";
import {
  JOURNEY_PLACEMENTS,
  replacementHeight,
  storyPose,
  type InteriorStyle,
  type StoryMotion,
} from "./homeStory";

function Scene({
  motion,
  theme,
  product,
  bedProduct,
  wardrobeProduct,
  ready,
  reduced,
  onStatus,
  onBedStatus,
  onWardrobeStatus,
}: SceneProps) {
  const sofa = useRef<THREE.Group>(null),
    bed = useRef<THREE.Group>(null),
    wardrobe = useRef<THREE.Group>(null);
  const sofaLabel = useRef<THREE.Group>(null),
    bedLabel = useRef<THREE.Group>(null),
    wardrobeLabel = useRef<THREE.Group>(null);
  const { camera, invalidate, size, gl } = useThree();
  const materials = useRoomMaterials();
  const eye = useMemo(() => new THREE.Vector3(), []),
    target = useMemo(() => new THREE.Vector3(), []);
  const initialized = useRef(false),
    progress = useRef(0),
    lastHeights = useRef("");
  useEffect(() => {
    const state = motion.current;
    state.invalidate = invalidate;
    invalidate();
    return () => {
      state.invalidate = undefined;
    };
  }, [invalidate, motion]);
  useEffect(() => {
    const perspective = camera as THREE.PerspectiveCamera;
    perspective.fov = size.width < 768 ? 80 : 52;
    perspective.filmOffset = size.width < 768 ? 0 : -4;
    perspective.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, invalidate]);
  useFrame((_, delta) => {
    if (motion.current.paused) return;
    const state = motion.current,
      snap = reduced || !initialized.current || state.snap;
    progress.current = snap
      ? state.progress
      : THREE.MathUtils.damp(
          progress.current,
          state.progress,
          9,
          Math.min(delta, 0.1),
        );
    if (Math.abs(progress.current - state.progress) < 0.0001)
      progress.current = state.progress;
    state.snap = false;
    const pose = storyPose(progress.current, 0, reduced);
    if (sofa.current)
      sofa.current.position.y = pose.sofaY + replacementHeight(state.swap);
    if (bed.current) bed.current.position.y = pose.bedY;
    if (wardrobe.current) {
      wardrobe.current.position.y = pose.wardrobeY;
      wardrobe.current.visible = pose.wardrobeVisible;
    }
    if (sofaLabel.current)
      sofaLabel.current.visible =
        progress.current >= 0.175 && progress.current < 0.25 && state.swap < 0;
    if (bedLabel.current)
      bedLabel.current.visible =
        progress.current >= 0.66 && progress.current < 0.76;
    if (wardrobeLabel.current)
      wardrobeLabel.current.visible = pose.landed && pose.wardrobeVisible;
    const heights = [
      pose.sofaY,
      pose.bedY,
      pose.wardrobeY,
      pose.wardrobeVisible,
      state.swap,
      theme.id,
    ].join(":");
    if (lastHeights.current !== heights) {
      gl.shadowMap.needsUpdate = true;
      lastHeights.current = heights;
    }
    eye.fromArray(pose.eye);
    target.fromArray(pose.target);
    camera.position.copy(eye);
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    initialized.current = true;
    if (
      state.visible &&
      !reduced &&
      (Math.abs(progress.current - state.progress) > 0.0001 || state.swap >= 0)
    )
      invalidate();
  });
  const fallbackSofa = (
    <group>
      <Upholstered
        position={[0, 0.3, 0]}
        size={[2.7, 0.5, 1.05]}
        color={theme.sofa}
        materials={materials}
      />
      <Upholstered
        position={[0, 0.72, -0.44]}
        size={[2.7, 0.65, 0.22]}
        color={theme.sofa}
        materials={materials}
      />
      {[-1.24, 1.24].map((x) => (
        <Upholstered
          key={x}
          position={[x, 0.5, 0]}
          size={[0.25, 0.65, 1.1]}
          color={theme.sofa}
          materials={materials}
        />
      ))}
    </group>
  );
  const label = (p: Product | undefined, title: string, category: string) => (
    <InteriorHotspot
      title={p?.name ?? title}
      detail={
        p
          ? `${p.basePrice.toLocaleString("mn-MN")} ₮-өөс`
          : "Интерьерийн загвар · Каталогоос сонгох"
      }
      href={p ? `/product/${p.id}` : `/catalog?category=${category}`}
      linkLabel={p ? "Бүтээгдэхүүнийг үзэх" : "Каталог үзэх"}
    />
  );
  return (
    <>
      <ApartmentRoom theme={theme} materials={materials} />
      <group ref={sofa} position={[...JOURNEY_PLACEMENTS.sofa.position]}>
        <FurnitureProduct
          product={product}
          size={JOURNEY_PLACEMENTS.sofa.size}
          onStatus={onStatus}
        >
          {fallbackSofa}
        </FurnitureProduct>
      </group>
      <group ref={bed} position={[...JOURNEY_PLACEMENTS.bed.position]}>
        <FurnitureProduct
          product={bedProduct}
          onStatus={onBedStatus}
          size={JOURNEY_PLACEMENTS.bed.size}
        >
          <InteriorBed materials={materials} />
        </FurnitureProduct>
      </group>
      <group
        ref={wardrobe}
        position={[...JOURNEY_PLACEMENTS.wardrobe.position]}
        rotation={[0, JOURNEY_PLACEMENTS.wardrobe.rotation, 0]}
      >
        <FurnitureProduct
          product={wardrobeProduct}
          onStatus={onWardrobeStatus}
          size={JOURNEY_PLACEMENTS.wardrobe.size}
        >
          <InteriorWardrobe materials={materials} />
        </FurnitureProduct>
      </group>
      <group ref={sofaLabel} visible={false}>
        <SceneHtml position={[-0.65, 1, -1.65]} center zIndexRange={[8, 5]}>
          {label(ready?.sofa ? product : undefined, "Буйдан", "sofa")}
        </SceneHtml>
      </group>
      <group ref={bedLabel} visible={false}>
        <SceneHtml
          position={[-0.65, 0.85, JOURNEY_PLACEMENTS.bed.position[2]]}
          center
          zIndexRange={[8, 5]}
        >
          {label(
            ready?.bed ? bedProduct : undefined,
            "Унтлагын өрөөний ор",
            "bed",
          )}
        </SceneHtml>
      </group>
      <group ref={wardrobeLabel} visible={false}>
        <SceneHtml position={[2.85, 1.3, -8.1]} center zIndexRange={[8, 5]}>
          {label(
            ready?.wardrobe ? wardrobeProduct : undefined,
            "Хувцасны шкаф",
            "wardrobe",
          )}
        </SceneHtml>
      </group>
    </>
  );
}
type SceneProps = {
  motion: RefObject<StoryMotion>;
  theme: InteriorStyle;
  product?: Product;
  bedProduct?: Product;
  wardrobeProduct?: Product;
  ready?: { sofa: boolean; bed: boolean; wardrobe: boolean };
  reduced: boolean;
  onStatus: (status: string) => void;
  onBedStatus?: (status: string) => void;
  onWardrobeStatus?: (status: string) => void;
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
function WebGLFallback({ onStatus }: { onStatus: (status: string) => void }) {
  useEffect(() => onStatus("unsupported"), [onStatus]);
  return null;
}
export default function InteriorScene(props: SceneProps) {
  return (
    <SceneBoundary onError={() => props.onStatus("unsupported")}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        frameloop="demand"
        camera={{ position: [1.9, 1.55, 3.2], fov: 52, near: 0.05, far: 40 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
        fallback={<WebGLFallback onStatus={props.onStatus} />}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          gl.shadowMap.autoUpdate = false;
          gl.shadowMap.needsUpdate = true;
        }}
      >
        <Scene {...props} />
        <CanvasDiagnostics scene="home-journey" />
      </Canvas>
    </SceneBoundary>
  );
}
