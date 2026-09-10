"use client";

import { Component, useEffect, useMemo, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Edges, OrbitControls } from "@react-three/drei";
import type { Texture } from "three";
import { FINISHES, kitchenHeight, type Cabinet, type Kitchen } from "@/lib/kitchen";
import { createKitchenTexture } from "./kitchenTextures";

type XYZ = [number, number, number];
type Surface = { color: string; map?: Texture | null; roughness?: number; metalness?: number };

function Board({ size, at, surface }: { size: XYZ; at: XYZ; surface: Surface }) {
  return <mesh position={at} castShadow receiveShadow>
    <boxGeometry args={size} />
    <meshStandardMaterial {...surface} />
  </mesh>;
}

function Front({ w, h, kitchen, surface }: { w: number; h: number; kitchen: Kitchen; surface: Surface }) {
  const framed = kitchen.front !== "flat";
  return <group>
    {framed ? <>
      <mesh>
        <boxGeometry args={[w - 0.075, h - 0.075, 0.012]} />
        <meshStandardMaterial {...surface} color={kitchen.front === "glass" ? "#b7d0d3" : surface.color}
          map={kitchen.front === "glass" ? null : surface.map}
          transparent={kitchen.front === "glass"} opacity={kitchen.front === "glass" ? 0.3 : 1}
          depthWrite={kitchen.front !== "glass"} />
      </mesh>
      {[-1, 1].map(side => <group key={side}>
        <Board size={[0.045, h, 0.025]} at={[side * (w / 2 - 0.0225), 0, 0.006]} surface={surface} />
        <Board size={[w - 0.09, 0.045, 0.025]} at={[0, side * (h / 2 - 0.0225), 0.006]} surface={surface} />
      </group>)}
    </> : <Board size={[w, h, 0.02]} at={[0, 0, 0]} surface={surface} />}
    {kitchen.handle === "bar" && <Board size={[Math.min(0.14, w * 0.55), 0.016, 0.035]}
      at={[0, h / 2 - 0.07, 0.035]} surface={{ color: "#383936", metalness: 0.75, roughness: 0.3 }} />}
    {kitchen.handle === "knob" && <mesh position={[0, h / 2 - 0.065, 0.035]}>
      <sphereGeometry args={[0.018, 12, 8]} />
      <meshStandardMaterial color="#9b8050" metalness={0.7} roughness={0.35} />
    </mesh>}
  </group>;
}

function CabinetBox({ w, h, d, kind, kitchen, surface, open }: {
  w: number; h: number; d: number; kind: Cabinet["kind"]; kitchen: Kitchen; surface: Surface; open: boolean;
}) {
  const inside: Surface = { color: "#e6e0d4", roughness: 0.85 };
  const double = kind === "double" || kind === "sink" || kind === "hob";
  const count = double ? 2 : 1;
  return <group>
    <Board size={[w, h, 0.018]} at={[0, h / 2, 0.009]} surface={inside} />
    {[-1, 1].map(side => <Board key={side} size={[0.018, h, d]}
      at={[side * (w / 2 - 0.009), h / 2, d / 2]} surface={surface} />)}
    {[0.009, h - 0.009].filter((_, index) => kind !== "sink" || index === 0).map(y =>
      <Board key={y} size={[w - 0.036, 0.018, d]} at={[0, y, d / 2]} surface={inside} />)}
    {kind !== "sink" && kind !== "drawers" && <Board size={[w - 0.036, 0.018, d - 0.03]}
      at={[0, h * 0.5, d / 2]} surface={inside} />}
    {kind === "drawers" ? [0, 1, 2].map(index => <group key={index}
      position={[0, h / 3 * (index + 0.5), d + 0.012 + (open ? 0.18 : 0)]}>
      {open && <>
        <Board size={[w - 0.06, 0.012, d * 0.7]} at={[0, -h / 6 + 0.03, -d * 0.35]} surface={inside} />
        {[-1, 1].map(side => <Board key={side} size={[0.012, h / 3 - 0.06, d * 0.7]}
          at={[side * (w / 2 - 0.036), 0, -d * 0.35]} surface={inside} />)}
      </>}
      <Front w={w - 0.006} h={h / 3 - 0.006} kitchen={{ ...kitchen, front: kitchen.front === "glass" ? "flat" : kitchen.front }} surface={surface} />
    </group>) : kind !== "open" && Array.from({ length: count }, (_, index) => {
      const right = double && index === 1;
      const hingeX = right ? w / 2 : -w / 2;
      const doorWidth = w / count;
      return <group key={index} position={[hingeX, h / 2, d + 0.012]}
        rotation={[0, open ? (right ? 1 : -1) * Math.PI * 0.38 : 0, 0]}>
        <group position={[right ? -doorWidth / 2 : doorWidth / 2, 0, 0]}>
          <Front w={doorWidth - 0.006} h={h - 0.006} kitchen={kitchen} surface={surface} />
        </group>
      </group>;
    })}
  </group>;
}

function Worktop({ w, d, height, kind, surface }: {
  w: number; d: number; height: number; kind: Cabinet["kind"]; surface: Surface;
}) {
  const metal: Surface = { color: "#929d9f", metalness: 0.85, roughness: 0.25 };
  return <group position={[0, height, 0]}>
    {kind === "sink" ? <>
      {[-1, 1].map(side => <group key={side}>
        <Board size={[(w - 0.44) / 2, 0.03, d + 0.035]}
          at={[side * (w / 4 + 0.11), -0.015, d / 2 + 0.0075]} surface={surface} />
        <Board size={[0.44, 0.03, (d - 0.34) / 2 + 0.0175]}
          at={[0, -0.015, d / 2 + side * (d / 4 + 0.085 + 0.00875) + 0.0075]} surface={surface} />
        <Board size={[0.009, 0.15, 0.34]} at={[side * 0.217, -0.075, d / 2 + 0.0075]} surface={metal} />
        <Board size={[0.44, 0.15, 0.009]} at={[0, -0.075, d / 2 + 0.0075 + side * 0.167]} surface={metal} />
      </group>)}
      <Board size={[0.44, 0.009, 0.34]} at={[0, -0.15, d / 2 + 0.0075]} surface={metal} />
      <Board size={[0.025, 0.23, 0.025]} at={[0, 0.115, 0.06]} surface={metal} />
      <Board size={[0.025, 0.025, 0.16]} at={[0, 0.23, 0.128]} surface={metal} />
    </> : <Board size={[w, 0.03, d + 0.035]} at={[0, -0.015, d / 2 + 0.0075]} surface={surface} />}
    {kind === "hob" && <group position={[0, 0.007, d / 2]}>
      <Board size={[0.52, 0.014, 0.44]} at={[0, 0, 0]} surface={{ color: "#191d20", roughness: 0.22 }} />
      {[-1, 1].flatMap(x => [-1, 1].map(z => <mesh key={`${x}-${z}`}
        position={[x * 0.135, 0.009, z * 0.11]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.059, 0.063, 32]} /><meshStandardMaterial color="#879296" />
      </mesh>))}
    </group>}
  </group>;
}

function CameraFit({ width, height }: { width: number; height: number }) {
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    // Vertical and horizontal framing both matter on a narrow phone viewport.
    const aspect = size.width / Math.max(size.height, 1);
    const distance = Math.max(height * 2, width / Math.max(aspect, 0.35) * 1.7, width * 1.15);
    camera.position.set(width * 0.42, height * 0.65 + distance * 0.18, distance);
    camera.lookAt(0, height / 2, 0);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, width, height, invalidate]);
  return null;
}

function KitchenScene({ kitchen, selected, onSelect, open }: ViewerProps) {
  const facadeMap = useMemo(() => createKitchenTexture(kitchen.finish), [kitchen.finish]);
  const topMap = useMemo(() => createKitchenTexture(kitchen.countertop), [kitchen.countertop]);
  useEffect(() => () => { facadeMap?.dispose(); }, [facadeMap]);
  useEffect(() => () => { topMap?.dispose(); }, [topMap]);
  const facade = FINISHES.find(finish => finish.id === kitchen.finish)!;
  const top = FINISHES.find(finish => finish.id === kitchen.countertop)!;
  const surface: Surface = { color: kitchen.color, map: facadeMap, roughness: facade.roughness };
  const topSurface: Surface = { color: top.color, map: topMap, roughness: top.roughness };
  const width = kitchen.width / 1000;
  const height = kitchen.height / 1000;
  const depth = kitchen.depth / 1000;
  const fullHeight = kitchenHeight(kitchen) / 1000;
  let offset = -width / 2;

  return <>
    <color attach="background" args={["#eaece8"]} />
    <ambientLight intensity={1.2} />
    <hemisphereLight args={["#ffffff", "#b9b0a0", 1.4]} />
    <directionalLight position={[2, 6, 5]} intensity={2.2} castShadow
      shadow-mapSize={[1024, 1024]} shadow-camera-left={-5} shadow-camera-right={5}
      shadow-camera-top={5} shadow-camera-bottom={-5} shadow-bias={-0.0005} />
    <CameraFit width={width} height={fullHeight} />
    <OrbitControls makeDefault target={[0, fullHeight / 2, 0]} minDistance={1} maxDistance={45}
      maxPolarAngle={Math.PI / 2 - 0.03} enablePan={false} />
    <group position={[0, 0, -depth / 2]}>
      {kitchen.backsplash && <Board size={[width, kitchen.gap / 1000, 0.012]}
        at={[0, height + kitchen.gap / 2000, -0.015]} surface={topSurface} />}
      {kitchen.cabinets.map(cabinet => {
        const w = cabinet.width / 1000;
        const x = offset + w / 2;
        offset += w;
        return <group key={cabinet.id} position={[x, 0, 0]}
          onClick={event => { if (event.delta > 5) return; event.stopPropagation(); onSelect(cabinet.id); }}>
          <Board size={[w - 0.012, 0.1, depth - 0.07]} at={[0, 0.05, (depth - 0.07) / 2]}
            surface={{ color: "#4d504b", roughness: 0.8 }} />
          <group position={[0, 0.1, 0]}>
            <CabinetBox w={w} h={height - 0.13} d={depth} kind={cabinet.kind}
              kitchen={kitchen} surface={surface} open={open} />
          </group>
          <Worktop w={w} d={depth} height={height} kind={cabinet.kind} surface={topSurface} />
          {cabinet.upper && <group position={[0, height + kitchen.gap / 1000, 0]}>
            <CabinetBox w={w} h={kitchen.upperHeight / 1000} d={kitchen.upperDepth / 1000}
              kind={cabinet.kind === "open" ? "open" : w >= 0.6 ? "double" : "single"}
              kitchen={kitchen} surface={{ ...surface, color: kitchen.upperColor }} open={open} />
          </group>}
          {selected === cabinet.id && <mesh position={[0, height / 2, depth / 2]}>
            <boxGeometry args={[w + 0.006, height + 0.006, depth + 0.065]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            <Edges color="#426d59" />
          </mesh>}
        </group>;
      })}
    </group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]} receiveShadow>
      <planeGeometry args={[30, 30]} /><meshStandardMaterial color="#e1e3dc" roughness={1} />
    </mesh>
  </>;
}

type ViewerProps = { kitchen: Kitchen; selected: string; onSelect: (id: string) => void; open: boolean };

class ViewerBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <p className="kp-viewer-message" role="status">3D дүрслэл ачаалагдсангүй. Хэмжээ болон шүүгээний жагсаалтаар загвараа үргэлжлүүлэн тохируулж болно.</p>
      : this.props.children;
  }
}

export function KitchenViewer(props: ViewerProps) {
  return <ViewerBoundary>
    <Canvas shadows dpr={[1, 1.5]} frameloop="demand" camera={{ position: [3, 2, 6], fov: 38 }}
      fallback={<p className="kp-viewer-message">Энэ төхөөрөмж 3D дүрслэлийг дэмжихгүй байна. Доорх шүүгээний жагсаалтыг ашиглана уу.</p>}>
      <KitchenScene {...props} />
    </Canvas>
  </ViewerBoundary>;
}
