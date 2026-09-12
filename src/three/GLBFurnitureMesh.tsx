"use client";
import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Edges, Html } from "@react-three/drei";
import * as THREE from "three";
import { chooseModelLod, modelLodFiles, type ModelLod } from "@/lib/modelAssets";
import { acquireModel, cloneModel, disposeModelClone, type LoadedModel } from "./modelLoader";

export interface GLBFurnitureMeshProps {
  modelId: string; basePath: string; glbFile: string;
  w: number; d: number; h: number; selected?: boolean; onReady?: () => void;
}
type Display = { key: string; level: ModelLod; asset: LoadedModel; release: () => void };
export function GLBFurnitureMesh({ modelId, basePath, glbFile, w, d, h, selected, onReady }: GLBFurnitureMeshProps) {
  const { gl, camera } = useThree();
  const root = useRef<THREE.Group>(null);
  const center = useRef(new THREE.Vector3()), cameraPosition = useRef(new THREE.Vector3());
  const elapsed = useRef(0);
  const callbacks = useRef({ onReady }); callbacks.current = { onReady };
  const [desired, setDesired] = useState<ModelLod>("low");
  const [display, setDisplay] = useState<Display | null>(null);
  const owned = useRef(new Set<Display>());
  const displayed = useRef(display); displayed.current = display;
  const [error, setError] = useState(false), [retry, setRetry] = useState(0);
  const base = basePath.endsWith("/") ? basePath : basePath + "/";
  const key = `${modelId}:${base}${glbFile}`;
  const hasLod = !!modelLodFiles(glbFile);
  useFrame((_, delta) => {
    elapsed.current += delta;
    if (elapsed.current < .25 || !root.current || !hasLod) return;
    elapsed.current = 0;
    root.current.localToWorld(center.current.set(0, h / 2, 0));
    camera.getWorldPosition(cameraPosition.current);
    const distance = cameraPosition.current.distanceTo(center.current);
    setDesired(previous => selected ? "high" : chooseModelLod(distance, previous));
  });
  useEffect(() => {
    let cancelled = false;
    const waiting = new Set<ReturnType<typeof acquireModel>>();
    setError(false);
    const files = modelLodFiles(glbFile);
    async function show(level: ModelLod, file: string) {
      const lease = acquireModel(gl, base + file);
      waiting.add(lease);
      try {
        const asset = await lease.promise;
        if (cancelled) return;
        const next = { key, level, asset: cloneModel(asset), release: lease.release };
        waiting.delete(lease);
        owned.current.add(next);
        displayed.current = next; setDisplay(next); callbacks.current.onReady?.();
      } finally { if (waiting.delete(lease)) lease.release(); }
    }
    const load = async () => {
      try {
        if (!files) { await show("high", glbFile); return; }
        if (displayed.current?.key !== key) {
          try { await show("low", files.low); }
          catch { if (!cancelled) await show("high", files.high); }
        }
        if (!cancelled && displayed.current?.level !== desired) await show(desired, files[desired]);
      } catch { if (!cancelled) setError(true); }
    };
    void load();
    return () => { cancelled = true; waiting.forEach(lease => lease.release()); waiting.clear(); };
  }, [gl, base, glbFile, key, desired, retry]);
  useEffect(() => {
    // Cached low/high promises may settle in the same React batch. Release even
    // clones whose intermediate state never reached a commit.
    for (const item of owned.current) if (item !== display) {
      disposeModelClone(item.asset); item.release(); owned.current.delete(item);
    }
  }, [display]);
  useEffect(() => {
    const items = owned.current;
    return () => { for (const item of items) { disposeModelClone(item.asset); item.release(); } items.clear(); };
  }, []);
  const ready = display?.key === key ? display : null;
  const size = ready?.asset.bounds.getSize(new THREE.Vector3());
  const origin = ready?.asset.bounds.getCenter(new THREE.Vector3());
  const valid = size && origin && Math.min(size.x, size.y, size.z) > 1e-9;
  return <group ref={root}>
    {ready && valid ? <group scale={[w / size.x, h / size.y, d / size.z]} dispose={null}>
      <primitive object={ready.asset.scene} position={[-origin.x, -ready.asset.bounds.min.y, -origin.z]} dispose={null} />
    </group> : <mesh position={[0, h / 2, 0]}>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={error ? "#d5a995" : "#d4dcd0"} transparent opacity={.45} />
      <Edges color="#6b7e68" />
    </mesh>}
    {(!ready || error) && <Html position={[0, h + .1, 0]} center zIndexRange={[8, 0]}>
      {error ? <button type="button" className="rounded bg-white px-2 py-1 text-xs whitespace-nowrap" onClick={event => { event.stopPropagation(); setRetry(value => value + 1); }}>3D дахин ачаалах</button>
        : <span role="status" className="pointer-events-none whitespace-nowrap rounded bg-white/90 px-2 py-1 text-xs">3D ачаалж байна…</span>}
    </Html>}
  </group>;
}
