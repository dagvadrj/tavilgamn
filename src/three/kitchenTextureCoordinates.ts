import { Box3, Float32BufferAttribute, Matrix4, Mesh, Vector3, type BufferGeometry, type Material, type Object3D, type Texture } from "three";

const owned = new WeakSet<BufferGeometry>();
type TexturedMaterial = Material & { map?: Texture | null; normalMap?: Texture | null; roughnessMap?: Texture | null; metalnessMap?: Texture | null };

function textureOf(mesh: Mesh) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.reduce<Texture | undefined>((texture, entry: TexturedMaterial) => texture ?? entry.map ?? entry.normalMap ?? entry.roughnessMap ?? entry.metalnessMap ?? undefined, undefined);
}

function usableUvs(geometry: BufferGeometry) {
  const uv = geometry.getAttribute("uv");
  const position = geometry.getAttribute("position");
  if (!uv || !position || uv.count !== position.count) return false;
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    if (!Number.isFinite(u) || !Number.isFinite(v)) return false;
    minU = Math.min(minU, u); maxU = Math.max(maxU, u);
    minV = Math.min(minV, v); maxV = Math.max(maxV, v);
  }
  return maxU - minU > 1e-7 && maxV - minV > 1e-7;
}

/** Fit the supplier image once across each cabinet plane. This is a preview
 * projection, not a claim about the manufacturer's physical texture repeat.
 * Existing UVs and cached source geometries are preserved. */
export function prepareKitchenTextureCoordinates(root: Object3D) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const bounds = new Box3();
  const matrices = new Map<Mesh, Matrix4>();
  root.traverse(object => {
    if (!(object instanceof Mesh) || !object.geometry.getAttribute("position")) return;
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    const matrix = inverse.clone().multiply(object.matrixWorld);
    matrices.set(object, matrix);
    if (object.geometry.boundingBox) bounds.union(object.geometry.boundingBox.clone().applyMatrix4(matrix));
  });
  const span = bounds.getSize(new Vector3());
  let generated = 0;
  for (const [mesh, matrix] of matrices) {
    const texture = textureOf(mesh);
    if (!texture || usableUvs(mesh.geometry)) continue;
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    const positions = geometry.getAttribute("position");
    const uv = new Float32Array(positions.count * 2);
    const a = new Vector3(), b = new Vector3(), c = new Vector3(), normal = new Vector3();
    const points = [a, b, c];
    const image = texture.image as { width?: number; height?: number } | undefined;
    const aspect = image?.width && image?.height ? image.width / image.height : 1;
    for (let i = 0; i < positions.count; i += 3) {
      if (i + 2 >= positions.count) break;
      points.forEach((point, j) => point.fromBufferAttribute(positions, i + j).applyMatrix4(matrix));
      normal.copy(b).sub(a).cross(c.clone().sub(a));
      const x = Math.abs(normal.x), y = Math.abs(normal.y), z = Math.abs(normal.z);
      const horizontal = x > y && x > z ? "z" : "x";
      const vertical = y > x && y > z ? "z" : "y";
      const width = Math.max(span[horizontal], 1e-7), height = Math.max(span[vertical], 1e-7);
      const planeAspect = width / height;
      const scaleU = Math.min(1, planeAspect / aspect), scaleV = Math.min(1, aspect / planeAspect);
      points.forEach((point, j) => {
        uv[(i + j) * 2] = 0.5 + ((point[horizontal] - bounds.min[horizontal]) / width - 0.5) * scaleU;
        // Supplier image textures use glTF's flipY=false convention.
        uv[(i + j) * 2 + 1] = 0.5 - ((point[vertical] - bounds.min[vertical]) / height - 0.5) * scaleV;
      });
    }
    geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
    owned.add(geometry);
    mesh.geometry = geometry;
    generated++;
  }
  return generated;
}

export function disposeKitchenTextureCoordinates(root: Object3D) {
  root.traverse(object => {
    if (object instanceof Mesh && owned.has(object.geometry)) {
      owned.delete(object.geometry);
      object.geometry.dispose();
    }
  });
}
