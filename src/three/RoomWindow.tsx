"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { RoomOpening } from "@/lib/types";
import { windowLayout } from "@/lib/roomOpenings";
import { ROOM_WALL_THICKNESS } from "@/lib/roomRendering";
import { animateToward } from "./demandAnimation";

function WindowSash({
  x,
  width,
  index,
  operation,
  open,
  children,
}: {
  x: number;
  width: number;
  index: number;
  operation: "fixed" | "sliding" | "casement";
  open: boolean;
  children: ReactNode;
}) {
  const ref = useRef<THREE.Group>(null),
    invalidate = useThree((s) => s.invalidate);
  const side = index === 0 ? -1 : 1,
    pivot = operation === "casement" ? (side * width) / 2 : 0;
  const angle = open && operation === "casement" ? side * Math.PI * 0.38 : 0;
  const offset =
    open && operation === "sliding" && index === 0 ? width * 0.82 : 0;
  useEffect(() => {
    invalidate();
  }, [angle, offset, invalidate]);
  useFrame((state, delta) => {
    if (!ref.current) return;
    const rotate = animateToward(ref.current.rotation.y, angle, 10, delta),
      move = animateToward(
        ref.current.position.x,
        x + pivot + offset,
        10,
        delta,
      );
    ref.current.rotation.y = rotate.value;
    ref.current.position.x = move.value;
    if (rotate.moving || move.moving) state.invalidate();
  });
  return (
    <group
      ref={ref}
      position={[
        x + pivot,
        0,
        operation === "sliding" ? -0.015 + index * 0.014 : 0,
      ]}
    >
      <group position={[-pivot, 0, 0]}>{children}</group>
    </group>
  );
}

/** The glass transmits daylight; the frame, mullions and sill cast real shadows. */
export function RoomWindow({ opening }: { opening: RoomOpening }) {
  const { width: w, height: h } = opening,
    { panes, operation } = windowLayout(opening);
  const frame = 0.06,
    mullion = 0.048,
    sashWidth = (w - 2 * frame - (panes - 1) * mullion) / panes,
    sashHeight = h - 2 * frame,
    sashFrame = 0.025,
    seal = 0.004,
    windowZ = -ROOM_WALL_THICKNESS / 2;
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side}>
          <RoundedBox
            args={[frame, h, ROOM_WALL_THICKNESS]}
            radius={0.004}
            smoothness={2}
            position={[
              (side * (w - frame)) / 2,
              h / 2,
              windowZ,
            ]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color="#f5f3ee"
              roughness={0.32}
              metalness={0.03}
            />
          </RoundedBox>
          <RoundedBox
            args={[w, frame, ROOM_WALL_THICKNESS]}
            radius={0.004}
            smoothness={2}
            position={[
              0,
              side === -1 ? frame / 2 : h - frame / 2,
              windowZ,
            ]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color="#f5f3ee"
              roughness={0.32}
              metalness={0.03}
            />
          </RoundedBox>
        </group>
      ))}
      {Array.from({ length: panes - 1 }, (_, index) => (
        <RoundedBox
          key={index}
          args={[mullion, h - 2 * frame, 0.145]}
          radius={0.003}
          smoothness={2}
          position={[
            -w / 2 + frame + (index + 1) * sashWidth + (index + 0.5) * mullion,
            h / 2,
            windowZ,
          ]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#f0efea" roughness={0.34} />
        </RoundedBox>
      ))}
      {/* Keep closed frames, glass and handles behind the interior wall face. */}
      <group position={[0, h / 2, windowZ]}>
        {Array.from({ length: panes }, (_, index) => {
          const x = (index - (panes - 1) / 2) * (sashWidth + mullion);
          return (
            <WindowSash
              key={index}
              x={x}
              width={sashWidth}
              index={index}
              operation={operation}
              open={opening.open}
            >
              {[-1, 1].map((side) => (
                <group key={side}>
                  <mesh
                    position={[(side * (sashWidth - sashFrame)) / 2, 0, 0]}
                    castShadow
                    receiveShadow
                  >
                    <boxGeometry args={[sashFrame, sashHeight, 0.07]} />
                    <meshStandardMaterial color="#eeeee9" roughness={0.38} />
                  </mesh>
                  <mesh
                    position={[0, (side * (sashHeight - sashFrame)) / 2, 0]}
                    castShadow
                    receiveShadow
                  >
                    <boxGeometry args={[sashWidth, sashFrame, 0.07]} />
                    <meshStandardMaterial color="#eeeee9" roughness={0.38} />
                  </mesh>
                  <mesh
                    position={[
                      side * (sashWidth / 2 - sashFrame - seal / 2),
                      0,
                      0.005,
                    ]}
                  >
                    <boxGeometry
                      args={[seal, sashHeight - 2 * sashFrame, 0.018]}
                    />
                    <meshStandardMaterial color="#5c625f" roughness={0.92} />
                  </mesh>
                  <mesh
                    position={[
                      0,
                      side * (sashHeight / 2 - sashFrame - seal / 2),
                      0.005,
                    ]}
                  >
                    <boxGeometry
                      args={[sashWidth - 2 * sashFrame, seal, 0.018]}
                    />
                    <meshStandardMaterial color="#5c625f" roughness={0.92} />
                  </mesh>
                </group>
              ))}
              <mesh>
                <boxGeometry
                  args={[
                    sashWidth - 2 * sashFrame - 2 * seal,
                    sashHeight - 2 * sashFrame - 2 * seal,
                    0.012,
                  ]}
                />
                <meshPhysicalMaterial
                  color="#eff7f9"
                  transmission={0.94}
                  transparent
                  opacity={0.3}
                  roughness={0.035}
                  thickness={0.012}
                  ior={1.52}
                  metalness={0}
                  clearcoat={1}
                  clearcoatRoughness={0.08}
                  envMapIntensity={1.2}
                  depthWrite={false}
                />
              </mesh>
              {operation !== "fixed" && (
                <group>
                  <RoundedBox
                    args={[0.018, 0.085, 0.035]}
                    radius={0.005}
                    smoothness={2}
                    position={[sashWidth / 2 - 0.039, -0.03, 0.054]}
                    castShadow
                  >
                    <meshStandardMaterial
                      color="#d7d8d4"
                      metalness={0.55}
                      roughness={0.26}
                    />
                  </RoundedBox>
                  <mesh
                    position={[sashWidth / 2 - 0.039, -0.015, 0.079]}
                    castShadow
                  >
                    <cylinderGeometry args={[0.007, 0.007, 0.09, 12]} />
                    <meshStandardMaterial
                      color="#dfe1dc"
                      metalness={0.6}
                      roughness={0.24}
                    />
                  </mesh>
                </group>
              )}
            </WindowSash>
          );
        })}
      </group>
      <RoundedBox
        args={[w + 0.13, 0.035, ROOM_WALL_THICKNESS]}
        radius={0.007}
        smoothness={3}
        position={[0, -0.018, -ROOM_WALL_THICKNESS / 2]}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial color="#f0eee7" roughness={0.36} />
      </RoundedBox>
      <mesh position={[0, -0.052, -0.0125]} receiveShadow>
        <boxGeometry args={[w + 0.06, 0.034, 0.025]} />
        <meshStandardMaterial color="#e7e4dc" roughness={0.7} />
      </mesh>
    </group>
  );
}
