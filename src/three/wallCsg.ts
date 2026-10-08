import * as THREE from "three";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";

export interface WallCut {
  /** Horizontal coordinate in the wall's local space, measured from its centre. */
  x: number;
  width: number;
  height: number;
  sillHeight: number;
}

/** Closed box subtraction leaves a real opening, including its jamb and lintel faces. */
export function createWallGeometry(length: number, height: number, thickness: number, cuts: WallCut[], ends?: { start: number; end: number }) {
  let geometry: THREE.BufferGeometry;
  if (ends && (ends.start !== 0 || ends.end !== 0)) {
    const footprint = new THREE.Shape([
      new THREE.Vector2(-length / 2, thickness / 2), new THREE.Vector2(length / 2, thickness / 2),
      new THREE.Vector2(length / 2 + ends.end, -thickness / 2), new THREE.Vector2(-length / 2 - ends.start, -thickness / 2),
    ]);
    geometry = new THREE.ExtrudeGeometry(footprint, { depth: height, bevelEnabled: false });
    geometry.rotateX(Math.PI / 2); geometry.translate(0, height / 2, 0);
  } else geometry = new THREE.BoxGeometry(length, height, thickness);
  geometry.clearGroups();
  const projectUV = () => {
    const positions = geometry.getAttribute("position"), uv = new Float32Array(positions.count * 2);
    for (let i=0;i<positions.count;i++) {
      uv[i*2] = positions.getX(i)/length+.5;
      uv[i*2+1] = positions.getY(i)/height+.5;
    }
    geometry.setAttribute("uv",new THREE.BufferAttribute(uv,2));
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
  };
  if (!cuts.length) return projectUV();
  const evaluator = new Evaluator();
  evaluator.useGroups = false;
  const material = new THREE.MeshBasicMaterial();
  try {
    for (const cut of cuts) {
      // Doors extend just below the floor to avoid coplanar triangles at the threshold.
      const bottom = cut.sillHeight === 0 ? -0.02 : cut.sillHeight;
      const top = cut.sillHeight + cut.height;
      const cutterGeometry = new THREE.BoxGeometry(cut.width, top - bottom, thickness + 0.1);
      cutterGeometry.clearGroups();
      const wallBrush = new Brush(geometry, material);
      const cutterBrush = new Brush(cutterGeometry, material);
      cutterBrush.position.set(cut.x, (top + bottom) / 2 - height / 2, 0);
      wallBrush.updateMatrixWorld(true);
      cutterBrush.updateMatrixWorld(true);
      try {
        const result = evaluator.evaluate(wallBrush, cutterBrush, SUBTRACTION);
        const previous = geometry;
        geometry = result.geometry;
        previous.dispose();
      } finally {
        wallBrush.disposeCacheData();
        cutterBrush.disposeCacheData();
        cutterGeometry.dispose();
      }
    }
    // Project every face onto one common wall UV plane; cutter UVs would stretch wallpaper.
    return projectUV();
  } catch (error) {
    geometry.dispose();
    throw error;
  } finally {
    material.dispose();
  }
}
