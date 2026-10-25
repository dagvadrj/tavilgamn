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
import {
  FurnitureProduct,
  InteriorBed,
  InteriorWardrobe,
  Upholstered,
} from "@/features/home-interior/JourneyFurniture";
import { ApartmentRoom } from "@/features/home-interior/ApartmentRoom";
import {
  INTERIOR_STYLES,
  JOURNEY_PLACEMENTS,
} from "@/features/home-interior/homeStory";
import { useRoomMaterials } from "@/features/home-interior/roomMaterials";
import {
  scrollRoomPose,
  type RoomMotion,
  type RoomFurniture,
} from "./scrollRoomStory";

type Props = {
  motion: RefObject<RoomMotion>;
  reduced: boolean;
  phase: number;
  sofa?: Product;
  bed?: Product;
  wardrobe?: Product;
  onSelect: (item: RoomFurniture) => void;
  onReady: () => void;
  onError: () => void;
  onSofaStatus: (value: string) => void;
  onBedStatus: (value: string) => void;
  onWardrobeStatus: (value: string) => void;
};
function Room(props: Props) {
  const { motion, reduced, onReady, onError } = props;
  const { camera, gl, invalidate, size } = useThree();
  const materials = useRoomMaterials();
  const bed = useRef<THREE.Group>(null),
    wardrobe = useRef<THREE.Group>(null);
  const progress = useRef<number | null>(null),
    target = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    const state = motion.current;
    state.invalidate = invalidate;
    const lost = (event: Event) => {
      event.preventDefault();
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
    c.fov = size.width < 700 ? 80 : 53;
    c.filmOffset = size.width < 700 ? 0 : -3;
    c.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, invalidate]);
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
            8,
            Math.min(delta, 0.1),
          );
    state.snap = false;
    const changed =
      progress.current === null || Math.abs(p - progress.current) > 0.00001;
    progress.current = Math.abs(p - destination) < 0.0001 ? destination : p;
    const pose = scrollRoomPose(progress.current);
    camera.position.fromArray(pose.eye);
    camera.lookAt(target.fromArray(pose.target));
    if (bed.current) {
      bed.current.position.y = pose.bedY;
      bed.current.visible = pose.bedVisible;
    }
    if (wardrobe.current) {
      wardrobe.current.position.y = pose.wardrobeY;
      wardrobe.current.visible = pose.wardrobeVisible;
    }
    if (changed) gl.shadowMap.needsUpdate = true;
    if (!reduced && !state.paused && progress.current !== destination)
      invalidate();
  });
  const label = (
    item: RoomFurniture,
    title: string,
    at: [number, number, number],
  ) => (
    <SceneHtml position={at} center zIndexRange={[5, 4]}>
      <button
        className="scroll-room-hotspot"
        onClick={() => props.onSelect(item)}
      >
        <span />
        {title}
      </button>
    </SceneHtml>
  );
  return (
    <>
      <ApartmentRoom theme={INTERIOR_STYLES[0]} materials={materials} />
      <group position={[...JOURNEY_PLACEMENTS.sofa.position]}>
        <FurnitureProduct
          product={props.sofa}
          size={JOURNEY_PLACEMENTS.sofa.size}
          onStatus={props.onSofaStatus}
        >
          <Upholstered
            position={[0, 0.35, 0]}
            size={[2.9, 0.45, 1.05]}
            color="#899485"
            materials={materials}
          />
          <Upholstered
            position={[0, 0.78, -0.42]}
            size={[2.9, 0.75, 0.32]}
            color="#899485"
            materials={materials}
          />
          {[-1.35, 1.35].map((x) => (
            <Upholstered
              key={x}
              position={[x, 0.55, 0]}
              size={[0.32, 0.7, 1.12]}
              color="#899485"
              materials={materials}
            />
          ))}
          {[-0.86, 0, 0.86].map((x) => (
            <Upholstered
              key={x}
              position={[x, 0.59, 0.04]}
              size={[0.8, 0.15, 0.84]}
              color="#a0a996"
              materials={materials}
            />
          ))}
        </FurnitureProduct>
        {props.phase === 0 && label("sofa", "Буйдан", [0.5, 1.15, 0.2])}
      </group>
      <group ref={bed} position={[-0.65, 2.855, -9.35]} visible={false}>
        <FurnitureProduct
          product={props.bed}
          size={JOURNEY_PLACEMENTS.bed.size}
          onStatus={props.onBedStatus}
        >
          <InteriorBed materials={materials} />
        </FurnitureProduct>
      </group>
      <group
        ref={wardrobe}
        position={[3.27, 2.82, -8.1]}
        rotation={[0, -Math.PI / 2, 0]}
        visible={false}
      >
        <FurnitureProduct
          product={props.wardrobe}
          size={JOURNEY_PLACEMENTS.wardrobe.size}
          onStatus={props.onWardrobeStatus}
        >
          <InteriorWardrobe materials={materials} />
        </FurnitureProduct>
      </group>
      {props.phase === 2 && label("bed", "Ор", [-0.4, 0.95, -8.6])}
      {props.phase === 3 && label("wardrobe", "Шкаф", [2.9, 1.3, -8.1])}
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
        dpr={[1, 1.5]}
        camera={{ position: [1.9, 1.55, 3.2], fov: 53, near: 0.05, far: 60 }}
        gl={{ antialias: true, alpha: false }}
        fallback={<span>Таны хөтөч 3D дүрслэлийг дэмжихгүй байна.</span>}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          gl.shadowMap.autoUpdate = false;
          gl.shadowMap.needsUpdate = true;
        }}
      >
        <Room {...props} />
      </Canvas>
    </Boundary>
  );
}
