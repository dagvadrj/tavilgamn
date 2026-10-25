import { Box3, Group, Mesh, Vector3, type Object3D } from "three";
import { kitchenSurfaceClassifier } from "./kitchenSurfaceClassification";
import type { KitchenPartMotion } from "./kitchenGlbComposition";

/** Add hinges to separated, existing GLB fronts; the cached source model stays untouched. */
export function prepareKitchenDoorMotion(root: Group, opening: "doors" | "drawers"): KitchenPartMotion[] {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const classify = kitchenSurfaceClassifier(root);
  const bounds = new Map<Mesh, Box3>();
  const fronts: Mesh[] = [];
  root.traverse(object => {
    if (!(object instanceof Mesh) || object.userData.kitchenOpeningPart) return;
    object.geometry.computeBoundingBox();
    if (!object.geometry.boundingBox) return;
    bounds.set(object, object.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(object.matrixWorld)));
    const material = Array.isArray(object.material) ? object.material[0] : object.material;
    if (classify(object, material) === "front") fronts.push(object);
  });
  if (!fronts.length) return [];
  const cabinet = new Box3();
  bounds.forEach(box => cabinet.union(box));
  const centre = cabinet.getCenter(new Vector3());
  const size = cabinet.getSize(new Vector3());
  // Associate authored handles with the nearest front before reparenting anything.
  const handles = new Map<Mesh, Mesh[]>();
  for (const [mesh, box] of bounds) {
    if (fronts.includes(mesh)) continue;
    const name = `${mesh.name} ${Array.isArray(mesh.material) ? mesh.material.map(m => m.name).join(" ") : mesh.material.name}`;
    if (!/handle|knob|бариул/i.test(name)) continue;
    const at = box.getCenter(new Vector3());
    const front = fronts.filter(door => {
      const face = bounds.get(door)!;
      return at.x >= face.min.x - .03 && at.x <= face.max.x + .03 && at.y >= face.min.y && at.y <= face.max.y && at.z >= face.min.z - .03;
    }).sort((a, b) => bounds.get(a)!.distanceToPoint(at) - bounds.get(b)!.distanceToPoint(at))[0];
    if (front) handles.set(front, [...(handles.get(front) ?? []), mesh]);
  }
  return fronts.map((front, index) => {
    const box = bounds.get(front)!;
    const at = box.getCenter(new Vector3());
    const left = fronts.length === 1 || at.x < centre.x;
    const hinge = new Group();
    hinge.name = `Kitchen-opening-${index + 1}`;
    hinge.position.set(opening === "drawers" ? at.x : left ? box.min.x : box.max.x, at.y, box.min.z);
    root.add(hinge);
    for (const part of [front, ...(handles.get(front) ?? [])]) {
      hinge.attach(part);
      part.userData.kitchenOpeningPart = true;
    }
    return {
      object: hinge,
      motion: opening === "drawers" ? { type: "slide" as const, axis: "z" as const, amount: Math.min(450, size.z * 700) }
        : { type: "hinge" as const, axis: "y" as const, amount: left ? -90 : 90 },
      closedPosition: hinge.position.toArray(),
    };
  });
}
