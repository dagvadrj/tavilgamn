import * as THREE from "three";

function geometryKey(geometry: THREE.BufferGeometry): string | null {
  if (Object.keys(geometry.morphAttributes).length || geometry.getAttribute("position")?.count > 50000) return null;
  let hash = 2166136261;
  for (const attribute of [geometry.index, ...Object.keys(geometry.attributes).sort().map(name => geometry.attributes[name])]) {
    if (!attribute) continue;
    if (!(attribute instanceof THREE.BufferAttribute)) return null;
    for (const byte of new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength)) hash = Math.imul(hash ^ byte, 16777619);
  }
  return `${hash}:${JSON.stringify(geometry.groups)}:${JSON.stringify(geometry.drawRange)}:${Object.keys(geometry.attributes).sort().join(",")}`;
}
function sameGeometry(a: THREE.BufferGeometry, b: THREE.BufferGeometry) {
  const left = [a.index, ...Object.keys(a.attributes).sort().map(key => a.attributes[key])];
  const right = [b.index, ...Object.keys(b.attributes).sort().map(key => b.attributes[key])];
  return left.length === right.length && left.every((attribute, i) => {
    const other = right[i];
    if (!attribute || !other) return attribute === other;
    if (!(attribute instanceof THREE.BufferAttribute) || !(other instanceof THREE.BufferAttribute) || attribute.itemSize !== other.itemSize || attribute.normalized !== other.normalized || attribute.array.constructor !== other.array.constructor || attribute.array.length !== other.array.length) return false;
    return attribute.array.every((value, index) => value === other.array[index]);
  });
}
/** Exact static leaves only. Call only for scenes with no animation tracks. */
export function instanceRepeatedModules(root: THREE.Group, minimum = 3): number {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const groups = new Map<string, THREE.Mesh[][]>();
  const hashes = new Map<THREE.BufferGeometry, string | null>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.SkinnedMesh || object instanceof THREE.InstancedMesh || object.children.length || object.morphTargetInfluences?.length || object.animations.length || !object.visible) return;
    for (let parent = object.parent; parent; parent = parent.parent) if (!parent.visible) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (materials.some(material => material.transparent || material.userData.noInstance) || object.userData.noInstance) return;
    const matrix = inverse.clone().multiply(object.matrixWorld);
    if (matrix.determinant() <= 0) return;
    const position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
    matrix.decompose(position, rotation, scale);
    const composed = new THREE.Matrix4().compose(position, rotation, scale);
    if (matrix.elements.some((value, i) => Math.abs(value - composed.elements[i]) > 1e-5)) return;
    if (!hashes.has(object.geometry)) hashes.set(object.geometry, geometryKey(object.geometry));
    const hash = hashes.get(object.geometry);
    if (hash === null) return;
    const key = `${hash}:${materials.map(material => material.uuid).join(",")}:${object.castShadow}:${object.receiveShadow}:${object.renderOrder}:${object.layers.mask}`;
    const bucket = groups.get(key) ?? [];
    let group = bucket.find(items => sameGeometry(items[0].geometry, object.geometry));
    if (!group) { group = []; bucket.push(group); groups.set(key, bucket); }
    group.push(object);
  });
  let saved = 0;
  for (const bucket of groups.values()) for (const meshes of bucket) {
    if (meshes.length < minimum) continue;
    const first = meshes[0], instances = new THREE.InstancedMesh(first.geometry, first.material, meshes.length);
    instances.name = `Instances: ${first.name || "module"}`;
    instances.castShadow = first.castShadow; instances.receiveShadow = first.receiveShadow;
    instances.renderOrder = first.renderOrder; instances.layers.mask = first.layers.mask;
    meshes.forEach((mesh, index) => { instances.setMatrixAt(index, inverse.clone().multiply(mesh.matrixWorld)); mesh.removeFromParent(); });
    instances.instanceMatrix.needsUpdate = true;
    instances.computeBoundingBox(); instances.computeBoundingSphere(); root.add(instances);
    saved += meshes.length - 1;
  }
  return saved;
}
