"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SceneHtml as Html } from "./SceneHtml";

/** Placeholder → model cross-fade length (B2.3). */
export const FURNITURE_FADE_MS = 200;
/** How long «Бэлэн» stays above a piece that just finished loading. */
const READY_CHIP_MS = 1400;
/** Opacity of the previous variant while the next one loads (B2.5). */
export const SWAP_DIM_OPACITY = 0.45;

type FadeState = { opacity: number; transparent: boolean };

/**
 * Multiplies every material of a delivered clone by `factor`; `null` restores
 * the authored values. Clones own their materials, so nothing shared changes.
 */
export function setModelOpacity(scene: THREE.Object3D, factor: number | null) {
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      const saved = material.userData.loadFade as FadeState | undefined;
      if (factor === null) {
        if (!saved) continue;
        material.opacity = saved.opacity;
        material.transparent = saved.transparent;
        delete material.userData.loadFade;
        material.needsUpdate = true;
        continue;
      }
      const base = saved ?? { opacity: material.opacity, transparent: material.transparent };
      if (!saved) {
        material.userData.loadFade = base;
        material.transparent = true;
        material.needsUpdate = true;
      }
      material.opacity = base.opacity * factor;
    }
  });
}

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

export type FurnitureLoadPhase = "loading" | "error" | "swapping" | "ready";

/**
 * Scene-side load states of a placed room piece (B2.1–B2.5). Everything stays
 * inside the piece's group, so a loading or failed piece can still be selected,
 * dragged, rotated and removed, and the model lands where the volume is.
 */
export function FurnitureLoadState({
  w,
  d,
  h,
  floorOffset = 0,
  phase,
  model,
  swapFailed,
  selected,
  onRetry,
  onRemove,
}: {
  w: number;
  d: number;
  h: number;
  /** Height of the piece above the floor; the footprint stays on the floor. */
  floorOffset?: number;
  phase: FurnitureLoadPhase;
  /** The delivered clone, when one is attached. */
  model?: THREE.Object3D;
  /** A new variant failed; the previous model is shown unchanged. */
  swapFailed: boolean;
  selected: boolean;
  onRetry: () => void;
  onRemove?: () => void;
}) {
  const volume = useRef<THREE.MeshBasicMaterial>(null);
  const footprint = useRef<THREE.MeshBasicMaterial>(null);
  const scan = useRef<THREE.Mesh>(null);
  const fade = useRef<{ model: THREE.Object3D; startedAt: number } | null>(null);
  const [fading, setFading] = useState(false);
  const [readyChip, setReadyChip] = useState(false);
  const shownModel = useRef<THREE.Object3D | undefined>(undefined);

  // The first model of a piece fades in over the placeholder; a variant swap
  // replaces the dimmed previous model directly.
  useEffect(() => {
    const previous = shownModel.current;
    shownModel.current = model;
    if (!model || model === previous) return;
    if (previous || reducedMotion()) {
      if (!previous) setReadyChip(true);
      return;
    }
    setModelOpacity(model, 0);
    fade.current = { model, startedAt: performance.now() };
    setFading(true);
    setReadyChip(true);
  }, [model]);
  useEffect(() => {
    if (!readyChip) return;
    const timer = setTimeout(() => setReadyChip(false), READY_CHIP_MS);
    return () => clearTimeout(timer);
  }, [readyChip]);

  const swapping = phase === "swapping" && !!model;
  useEffect(() => {
    if (!model || !swapping) return;
    setModelOpacity(model, SWAP_DIM_OPACITY);
    // An error or the next model restores the previous one at full opacity.
    return () => setModelOpacity(model, null);
  }, [model, swapping]);
  useEffect(() => () => {
    if (fade.current) setModelOpacity(fade.current.model, null);
  }, []);

  useFrame((state) => {
    const now = performance.now();
    const still = reducedMotion();
    if (fade.current) {
      const t = Math.min(1, (now - fade.current.startedAt) / FURNITURE_FADE_MS);
      if (t >= 1) {
        setModelOpacity(fade.current.model, null);
        fade.current = null;
        setFading(false);
      } else setModelOpacity(fade.current.model, t);
      if (volume.current) volume.current.opacity = 0.22 * (1 - t);
      if (footprint.current) footprint.current.opacity = 0.18 * (1 - t);
      state.invalidate();
      return;
    }
    if (phase === "loading" && volume.current && !still) {
      // Opacity shimmer only; the volume never scales (B2.1).
      volume.current.opacity = 0.14 + 0.1 * (0.5 + 0.5 * Math.sin(now / 220));
      state.invalidate();
    }
    if (swapping && scan.current && !still) {
      scan.current.position.y = h * ((now / 1400) % 1);
      state.invalidate();
    }
  });

  const dashed = useMemo(() => {
    const box = new THREE.BoxGeometry(w, h, d);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    return edges;
  }, [w, h, d]);
  useEffect(() => () => dashed.dispose(), [dashed]);

  const failed = phase === "error" && !model;
  const showVolume = (!model && !failed) || fading;
  const tone = failed ? "#d92d20" : "#1463df";
  const chip = failed
    ? selected
      ? "error"
      : null
    : swapFailed
      ? selected
        ? "swap-error"
        : null
      : swapping
        ? "swapping"
        : !model
          ? "loading"
          : readyChip
            ? "ready"
            : null;

  return (
    <group userData={{ exportExclude: true, deliveryPlaceholder: !model }}>
      {(showVolume || failed) && (
        <>
          <mesh
            name="FurnitureLoadingPlaceholder"
            position={[0, h / 2, 0]}
            userData={{ exportExclude: true, deliveryPlaceholder: true }}
          >
            <boxGeometry args={[w, h, d]} />
            <meshBasicMaterial
              ref={volume}
              color={failed ? "#f04438" : "#9ab7d0"}
              transparent
              opacity={failed ? 0.1 : 0.22}
              depthWrite={false}
            />
          </mesh>
          <lineSegments
            geometry={dashed}
            position={[0, h / 2, 0]}
            onUpdate={(line) => line.computeLineDistances()}
            raycast={() => null}
          >
            {failed ? (
              <lineDashedMaterial color={tone} dashSize={0.06} gapSize={0.04} />
            ) : (
              <lineBasicMaterial color={tone} transparent opacity={0.7} />
            )}
          </lineSegments>
          <mesh
            position={[0, -floorOffset + 0.004, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            raycast={() => null}
          >
            <planeGeometry args={[w, d]} />
            <meshBasicMaterial
              ref={footprint}
              color={tone}
              transparent
              opacity={failed ? 0.16 : 0.18}
              depthWrite={false}
            />
          </mesh>
        </>
      )}
      {swapping && (
        <mesh
          ref={scan}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={() => null}
        >
          <planeGeometry args={[w * 1.04, d * 1.04]} />
          <meshBasicMaterial
            color="#1463df"
            transparent
            opacity={0.28}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      {chip && (
        <Html position={[0, h + 0.12, 0]} center zIndexRange={[8, 0]}>
          <div
            className="room-scene-chip"
            data-state={chip}
            role={chip === "error" || chip === "swap-error" ? "alert" : "status"}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <span>
              {chip === "error"
                ? "Загвар ачаалагдсангүй"
                : chip === "swap-error"
                  ? "Шинэ хувилбар ачаалагдсангүй"
                  : chip === "swapping"
                    ? "Хувилбар солиж байна…"
                    : chip === "loading"
                      ? "Ачаалж байна…"
                      : "Бэлэн"}
            </span>
            {(chip === "error" || chip === "swap-error") && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onRetry();
                }}
              >
                Дахин оролдох
              </button>
            )}
            {chip === "error" && onRemove && (
              <button
                type="button"
                className="is-danger"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove();
                }}
              >
                Хасах
              </button>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}
