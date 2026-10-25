import { Box3, Vector3, type Material, type Mesh, type Object3D } from "three";
import { kitchenCabinetSurface, type KitchenCabinetSurface } from "@/lib/kitchenMaterials";

/** Imported cabinet assets face local +Z. Recognise unnamed front panels by their
 * measured shape/position, while leaving small unnamed hardware authored. */
export function kitchenSurfaceClassifier(root: Object3D) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const bounds = new Box3();
  const meshBounds = new Map<Mesh, Box3>();
  root.traverse(object => {
    if (!("isMesh" in object) || !object.isMesh) return;
    const mesh = object as Mesh;
    // Bounds in cabinet coordinates, including authored mesh/node transforms.
    const geometry = mesh.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingBox) return;
    const box = geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld));
    meshBounds.set(mesh, box);
    bounds.union(box);
  });
  const size = bounds.getSize(new Vector3());
  return (mesh: Mesh, material: Material): KitchenCabinetSurface | null => {
    const ancestors: string[] = [];
    for (let node: Object3D | null = mesh; node && node !== root; node = node.parent) ancestors.push(node.name);
    const name = ancestors.join(" ");
    if (kitchenCabinetSurface(name, material.name) === null) return null;
    const named = kitchenCabinetSurface(name, material.name, null);
    if (named) return named;
    const box = meshBounds.get(mesh);
    if (!box || size.x <= 0 || size.y <= 0 || size.z <= 0) return "carcass";
    const part = box.getSize(new Vector3());
    if (part.x < size.x * 0.15 && part.y < size.y * 0.2 && part.z < size.z * 0.25) return null;
    const thin = part.z <= Math.min(0.06, size.z * 0.15);
    const atFront = box.min.z >= bounds.max.z - size.z * 0.2;
    return thin && atFront && part.x >= size.x * 0.15 && part.y >= size.y * 0.2 ? "front" : "carcass";
  };
}
