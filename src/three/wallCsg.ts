import * as THREE from "three";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";

export interface WallCut {
  /** Horizontal coordinate in the wall's local space, measured from its centre. */
  x: number;
  width: number;
  height: number;
  sillHeight: number;
}

export interface WallEnds {
  start: number;
  end: number;
  /** Remove an internal joint cap, or only its portion below the given height. */
  openStart?: boolean | number;
  openEnd?: boolean | number;
}

function removeJoinedCaps(
  geometry: THREE.BufferGeometry,
  length: number,
  height: number,
  thickness: number,
  ends?: WallEnds,
) {
  if (!ends?.openStart && !ends?.openEnd) return;
  const positions = geometry.getAttribute("position");
  const indices = geometry.index;
  const count = indices?.count ?? positions.count;
  const retained: number[] = [];
  const attributes = Object.entries(geometry.attributes);
  const values = Object.fromEntries(attributes.map(([name, attribute]) => [name, Array.from(attribute.array)]));
  const elevation = (index: number) => values.position[index * 3 + 1];
  const intersection = (a: number, b: number, y: number) => {
    const index = values.position.length / 3;
    const ratio = (y - elevation(a)) / (elevation(b) - elevation(a));
    for (const [name, attribute] of attributes) {
      const data = values[name], size = attribute.itemSize;
      for (let c = 0; c < size; c++) data.push(data[a * size + c] + (data[b * size + c] - data[a * size + c]) * ratio);
    }
    return index;
  };
  const onCap = (index: number, start: boolean) => {
    const extension = start ? ends.start : ends.end;
    const edge =
      (start ? -1 : 1) *
      (length / 2 + extension * (0.5 - positions.getZ(index) / thickness));
    return Math.abs(positions.getX(index) - edge) < 0.00001;
  };
  for (let i = 0; i < count; i += 3) {
    const triangle = [0, 1, 2].map(offset =>
      indices ? indices.getX(i + offset) : i + offset,
    );
    const opening = ends.openStart && triangle.every(index => onCap(index, true)) ? ends.openStart
      : ends.openEnd && triangle.every(index => onCap(index, false)) ? ends.openEnd : false;
    if (opening === true) continue;
    if (typeof opening === "number") {
      const bottom = opening - height / 2;
      const clipped: number[] = [];
      for (let j = 0; j < 3; j++) {
        const a = triangle[j], b = triangle[(j + 1) % 3];
        const insideA = elevation(a) >= bottom, insideB = elevation(b) >= bottom;
        if (insideA) clipped.push(a);
        if (insideA !== insideB) clipped.push(intersection(a, b, bottom));
      }
      for (let j = 1; j < clipped.length - 1; j++) retained.push(clipped[0], clipped[j], clipped[j + 1]);
      continue;
    }
    retained.push(...triangle);
  }
  if (values.position.length > positions.array.length) {
    for (const [name, attribute] of attributes)
      geometry.setAttribute(name, new THREE.Float32BufferAttribute(values[name], attribute.itemSize, attribute.normalized));
  }
  geometry.setIndex(retained);
}

/** Closed box subtraction leaves a real opening, including its jamb and lintel faces. */
export function createWallGeometry(length: number, height: number, thickness: number, cuts: WallCut[], ends?: WallEnds) {
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
    // Keep the solid closed throughout CSG. Strip only the internal joint faces
    // afterwards so adjacent walls cannot draw or shadow coincident miter caps.
    removeJoinedCaps(geometry, length, height, thickness, ends);
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
