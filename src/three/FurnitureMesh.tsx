"use client";
import { useMemo } from "react";
import * as THREE from "three";
import type { Category, Material } from "@/lib/types";
import { cushionColor, makeMaterial } from "./materials";

export interface FurnitureMeshProps {
  category: Category;
  color: string;
  material: Material;
  /** dimensions in meters */
  w: number;
  d: number;
  h: number;
  /** Add a subtle selection outline (used in room planner) */
  selected?: boolean;
}

/** Procedural mesh per category — runs without external GLB assets. */
export function FurnitureMesh({
  category,
  color,
  material,
  w,
  d,
  h,
  selected,
}: FurnitureMeshProps) {
  const mat = useMemo(
    () => makeMaterial({ color, material }),
    [color, material],
  );
  const cushionMat = useMemo(
    () => makeMaterial({ color: cushionColor(color, -0.05), material }),
    [color, material],
  );
  const frameMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#3D2F26"),
        roughness: 0.7,
      }),
    [],
  );
  const metalMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#7A7A7E"),
        roughness: 0.3,
        metalness: 0.9,
      }),
    [],
  );

  // Categories that should use chocolate-frame + cushion split:
  const upholstered = category === "sofa" || category === "bed";

  switch (category) {
    case "sofa":
      return (
        <group position={[0, 0, 0]}>
          {/* base */}
          <mesh position={[0, 0.2, 0]} castShadow receiveShadow material={mat}>
            <boxGeometry args={[w, 0.4, d]} />
          </mesh>
          {/* seat cushions */}
          {[-1, 0, 1].map((i) => (
            <mesh
              key={i}
              position={[(i * w) / 3.2, 0.5, 0.02]}
              castShadow
              material={cushionMat}
            >
              <boxGeometry args={[w / 3.3, 0.2, d * 0.8]} />
            </mesh>
          ))}
          {/* backrest */}
          <mesh
            position={[0, 0.55 + (h - 0.55) / 2, -d / 2 + 0.12]}
            castShadow
            material={mat}
          >
            <boxGeometry args={[w, h - 0.4, 0.22]} />
          </mesh>
          {/* arms */}
          {[-1, 1].map((s) => (
            <mesh
              key={s}
              position={[s * (w / 2 - 0.1), 0.55, 0]}
              castShadow
              material={mat}
            >
              <boxGeometry args={[0.18, 0.55, d * 0.95]} />
            </mesh>
          ))}
          {/* legs */}
          {[-1, 1].map((sx) =>
            [-1, 1].map((sz) => (
              <mesh
                key={`l-${sx}-${sz}`}
                position={[sx * (w / 2 - 0.15), 0.05, sz * (d / 2 - 0.15)]}
                material={frameMat}
              >
                <cylinderGeometry args={[0.04, 0.04, 0.1, 12]} />
              </mesh>
            )),
          )}
          {selected && <SelectionBox w={w} d={d} h={h} />}
        </group>
      );

    case "bed":
      return (
        <group>
          {/* mattress */}
          <mesh position={[0, 0.4, 0]} castShadow material={cushionMat}>
            <boxGeometry args={[w * 0.95, 0.3, d * 0.88]} />
          </mesh>
          {/* frame */}
          <mesh position={[0, 0.2, 0]} castShadow material={frameMat}>
            <boxGeometry args={[w, 0.18, d]} />
          </mesh>
          {/* headboard */}
          <mesh
            position={[0, h - 0.4, -d / 2 + 0.08]}
            castShadow
            material={mat}
          >
            <boxGeometry args={[w, h - 0.3, 0.16]} />
          </mesh>
          {/* legs */}
          {[-1, 1].map((sx) =>
            [-1, 1].map((sz) => (
              <mesh
                key={`l-${sx}-${sz}`}
                position={[sx * (w / 2 - 0.1), 0.06, sz * (d / 2 - 0.1)]}
                material={frameMat}
              >
                <boxGeometry args={[0.08, 0.12, 0.08]} />
              </mesh>
            )),
          )}
          {selected && <SelectionBox w={w} d={d} h={h} />}
        </group>
      );

    case "dining-table":
      return (
        <group>
          {/* top */}
          <mesh position={[0, h - 0.05, 0]} castShadow material={mat}>
            {w === d ? (
              <cylinderGeometry args={[w / 2, w / 2, 0.08, 48]} />
            ) : (
              <boxGeometry args={[w, 0.08, d]} />
            )}
          </mesh>
          {/* pedestal or legs */}
          {w === d ? (
            <>
              <mesh position={[0, (h - 0.08) / 2, 0]} material={mat}>
                <cylinderGeometry args={[0.12, 0.12, h - 0.08, 24]} />
              </mesh>
              <mesh position={[0, 0.025, 0]} material={mat}>
                <cylinderGeometry args={[0.4, 0.4, 0.05, 36]} />
              </mesh>
            </>
          ) : (
            [-1, 1].map((sx) =>
              [-1, 1].map((sz) => (
                <mesh
                  key={`l-${sx}-${sz}`}
                  position={[
                    sx * (w / 2 - 0.15),
                    (h - 0.08) / 2,
                    sz * (d / 2 - 0.15),
                  ]}
                  material={mat}
                >
                  <boxGeometry args={[0.08, h - 0.08, 0.08]} />
                </mesh>
              )),
            )
          )}
          {selected && <SelectionBox w={w} d={d} h={h} />}
        </group>
      );

    case "wardrobe":
      return (
        <group>
          {/* body */}
          <mesh position={[0, h / 2, 0]} castShadow material={mat}>
            <boxGeometry args={[w, h, d]} />
          </mesh>
          {/* doors split */}
          {[-1, 0, 1]
            .slice(0, Math.max(2, Math.round(w / 0.6)))
            .map((i, _, arr) => {
              const cols = arr.length;
              const segW = w / cols;
              const x = -w / 2 + segW / 2 + segW * arr.indexOf(i);
              return (
                <mesh
                  key={i}
                  position={[x, h / 2, d / 2 + 0.005]}
                  material={frameMat}
                >
                  <boxGeometry args={[segW - 0.02, h - 0.04, 0.01]} />
                </mesh>
              );
            })}
          {/* handles */}
          {[-1, 1].map((sx) => (
            <mesh
              key={sx}
              position={[sx * (w / 4), h / 2, d / 2 + 0.04]}
              material={metalMat}
            >
              <cylinderGeometry args={[0.012, 0.012, 0.16, 12]} />
            </mesh>
          ))}
          {selected && <SelectionBox w={w} d={d} h={h} />}
        </group>
      );

    case "office":
      return (
        <group>
          {h > 1 ? (
            /* a chair */
            <>
              <mesh position={[0, 0.45, 0]} castShadow material={cushionMat}>
                <cylinderGeometry args={[0.25, 0.25, 0.08, 24]} />
              </mesh>
              <mesh position={[0, 0.8, -0.22]} castShadow material={cushionMat}>
                <boxGeometry args={[0.5, 0.55, 0.08]} />
              </mesh>
              <mesh position={[0, 0.22, 0]} material={metalMat}>
                <cylinderGeometry args={[0.025, 0.025, 0.4, 16]} />
              </mesh>
              <mesh position={[0, 0.04, 0]} material={metalMat}>
                <cylinderGeometry args={[0.3, 0.3, 0.04, 32]} />
              </mesh>
              {[0, 1, 2, 3, 4].map((i) => {
                const a = (i / 5) * Math.PI * 2;
                return (
                  <mesh
                    key={i}
                    position={[Math.cos(a) * 0.25, 0.02, Math.sin(a) * 0.25]}
                    material={metalMat}
                  >
                    <sphereGeometry args={[0.03, 8, 8]} />
                  </mesh>
                );
              })}
            </>
          ) : (
            /* a desk */
            <>
              <mesh position={[0, h - 0.04, 0]} castShadow material={mat}>
                <boxGeometry args={[w, 0.05, d]} />
              </mesh>
              {[-1, 1].map((sx) =>
                [-1, 1].map((sz) => (
                  <mesh
                    key={`${sx}-${sz}`}
                    position={[
                      sx * (w / 2 - 0.06),
                      (h - 0.05) / 2,
                      sz * (d / 2 - 0.06),
                    ]}
                    material={metalMat}
                  >
                    <boxGeometry args={[0.04, h - 0.05, 0.04]} />
                  </mesh>
                )),
              )}
              {/* drawer block */}
              <mesh position={[w / 3, (h - 0.05) / 2, -d / 4]} material={mat}>
                <boxGeometry args={[w / 3, h - 0.25, d * 0.55]} />
              </mesh>
            </>
          )}
          {selected && <SelectionBox w={w} d={d} h={h} />}
        </group>
      );

    case "tv-stand":
      return (
        <group>
          <mesh position={[0, h / 2, 0]} castShadow material={mat}>
            <boxGeometry args={[w, h, d]} />
          </mesh>
          {/* center line */}
          <mesh position={[0, h / 2, d / 2 + 0.005]} material={frameMat}>
            <boxGeometry args={[w - 0.05, 0.02, 0.005]} />
          </mesh>
          {selected && <SelectionBox w={w} d={d} h={h} />}
        </group>
      );

    case "bookshelf":
      return (
        <group>
          {/* sides */}
          {[-1, 1].map((sx) => (
            <mesh
              key={sx}
              position={[sx * (w / 2 - 0.02), h / 2, 0]}
              castShadow
              material={mat}
            >
              <boxGeometry args={[0.04, h, d]} />
            </mesh>
          ))}
          {/* shelves */}
          {Array.from({ length: 5 }).map((_, i) => {
            const y = ((i + 0.5) * h) / 5;
            return (
              <mesh key={i} position={[0, y, 0]} material={mat}>
                <boxGeometry args={[w - 0.04, 0.04, d]} />
              </mesh>
            );
          })}
          {/* back */}
          <mesh position={[0, h / 2, -d / 2 + 0.02]} material={frameMat}>
            <boxGeometry args={[w - 0.04, h, 0.02]} />
          </mesh>
          {/* books — decorative */}
          {Array.from({ length: 12 }).map((_, i) => {
            const shelf = i % 5;
            const x = -w / 2 + 0.12 + (i % 6) * 0.16;
            const y = ((shelf + 0.5) * h) / 5 + 0.12;
            const c = ["#8C5A3C", "#3D5A4A", "#B0654A", "#1F2638", "#C68642"][
              i % 5
            ];
            return (
              <mesh
                key={i}
                position={[x, y, 0]}
                material={
                  new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })
                }
              >
                <boxGeometry args={[0.05, 0.22, d * 0.7]} />
              </mesh>
            );
          })}
          {selected && <SelectionBox w={w} d={d} h={h} />}
        </group>
      );

    default:
      return (
        <mesh position={[0, h / 2, 0]} material={mat}>
          <boxGeometry args={[w, h, d]} />
        </mesh>
      );
  }
  // Unreachable
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _unused = upholstered;
}

function SelectionBox({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <mesh position={[0, h / 2, 0]}>
      <boxGeometry args={[w + 0.05, h + 0.05, d + 0.05]} />
      <meshBasicMaterial color="#C4633A" transparent opacity={0.15} />
    </mesh>
  );
}
