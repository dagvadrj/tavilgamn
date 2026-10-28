import * as THREE from "three";
import { acceleratedRaycast, computeBoundsTree } from "three-mesh-bvh";

/** Below this, brute-force raycasting is already cheaper than building a tree. */
export const RAYCAST_BVH_MIN_TRIANGLES = 2000;

// Pointer events raycast every interactive object on each move. A dense model
// (a 300k-triangle sofa took ~15 ms per ray) turned hover and drag into
// main-thread long tasks. Meshes fall back to brute force until a tree exists.
let patched = false;
export function enableAcceleratedRaycast() {
  if (patched) return;
  THREE.Mesh.prototype.raycast = acceleratedRaycast;
  patched = true;
}

function needsTree(object: THREE.Object3D): object is THREE.Mesh {
  if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || object instanceof THREE.SkinnedMesh) return false;
  const geometry = object.geometry as THREE.BufferGeometry & { boundsTree?: unknown };
  // Morph targets move vertices away from what a static tree indexes.
  if (geometry.boundsTree || Object.keys(geometry.morphAttributes).length) return false;
  const count = geometry.index?.count ?? geometry.getAttribute("position")?.count ?? 0;
  return count / 3 >= RAYCAST_BVH_MIN_TRIANGLES;
}

/** Builds one tree per geometry; clones share geometry and therefore the tree. */
export function buildRaycastTrees(root: THREE.Object3D) {
  root.traverse((object) => {
    // Indirect keeps the index buffer (and faceIndex) exactly as uploaded.
    // (three-mesh-bvh 0.8.3 supports the option; its typings omit it.)
    if (needsTree(object))
      computeBoundsTree.call(object.geometry, { indirect: true } as Parameters<typeof computeBoundsTree>[0]);
  });
}

/** Defers tree building until the model is on screen and the browser is idle. */
export function scheduleRaycastTrees(root: THREE.Object3D) {
  const run = () => buildRaycastTrees(root);
  if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 1500 });
  else setTimeout(run, 0);
}
