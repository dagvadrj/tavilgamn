import * as THREE from "three";
import { modelPlacement } from "@/lib/modelPlacement";
import { ROOM_SKIRTING_HEIGHT } from "@/lib/roomRendering";
import {
  cacheModelFloorBand,
  getModelFloorBandEntry,
  type FloorBandRect,
} from "@/lib/modelFloorBand";

export { modelFloorBand, type FloorBandRect } from "@/lib/modelFloorBand";

/** Clip triangles to the bottom 60 mm after the exact display transform.
 * A leg may cross this band without having a vertex inside it; vertex-only tests miss that leg.
 */
export function registerModelFloorBand(
  id: string,
  scene: THREE.Object3D,
  bounds: THREE.Box3,
  size: { w: number; h: number; d: number },
  physical: boolean,
  source: string,
  high: boolean,
) {
  const previous = getModelFloorBandEntry(id, size);
  if (previous?.source === source || (previous?.high && !high)) return;
  const placement = modelPlacement(bounds, size, physical),
    instance = new THREE.Matrix4(),
    matrix = new THREE.Matrix4();
  const rects: FloorBandRect[] = [];
  scene.updateMatrixWorld(true);
  const clip = (polygon: THREE.Vector3[], height: number, below: boolean) => {
    const result: THREE.Vector3[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i],
        b = polygon[(i + 1) % polygon.length];
      const inA = below ? a.y <= height : a.y >= height,
        inB = below ? b.y <= height : b.y >= height;
      if (inA) result.push(a);
      if (inA !== inB)
        result.push(a.clone().lerp(b, (height - a.y) / (b.y - a.y)));
    }
    return result;
  };
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const position = object.geometry.getAttribute("position"),
      index = object.geometry.index;
    if (!position) return;
    for (
      let n = 0;
      n < (object instanceof THREE.InstancedMesh ? object.count : 1);
      n++
    ) {
      matrix.copy(object.matrixWorld);
      if (object instanceof THREE.InstancedMesh) {
        object.getMatrixAt(n, instance);
        matrix.multiply(instance);
      }
      let minX = Infinity,
        maxX = -Infinity,
        minZ = Infinity,
        maxZ = -Infinity;
      const triangle = [
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
      ];
      for (let i = 0; i + 2 < (index?.count ?? position.count); i += 3) {
        for (let j = 0; j < 3; j++) {
          const point = triangle[j];
          object.getVertexPosition(index ? index.getX(i + j) : i + j, point);
          point.applyMatrix4(matrix);
          point.set(
            (point.x + placement.position[0]) * placement.scale[0],
            (point.y + placement.position[1]) * placement.scale[1],
            (point.z + placement.position[2]) * placement.scale[2],
          );
        }
        if (
          triangle.every((p) => p.y > ROOM_SKIRTING_HEIGHT) ||
          triangle.every((p) => p.y < -0.00001)
        )
          continue;
        for (const p of clip(
          clip(triangle, ROOM_SKIRTING_HEIGHT, true),
          -0.00001,
          false,
        )) {
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minZ = Math.min(minZ, p.z);
          maxZ = Math.max(maxZ, p.z);
        }
      }
      if (Number.isFinite(minX) && maxX - minX > 1e-7 && maxZ - minZ > 1e-7)
        rects.push({ minX, maxX, minZ, maxZ });
    }
  });
  cacheModelFloorBand(id, size, { rects, source, high });
}
