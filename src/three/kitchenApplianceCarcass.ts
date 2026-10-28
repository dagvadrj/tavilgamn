import { Box3, Matrix4, Vector3, type Mesh, type Object3D } from "three";

/** Use the imported sides, feet and base unchanged. Remove only separate authored
 * panels that occupy the chosen appliance opening; never stretch/rebuild a SKU. */
export function prepareKitchenApplianceCarcass(root: Object3D, adaptation?: "sink" | "hob" | "oven" | "hood") {
  if (!adaptation || adaptation === 'hood') return;
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert(), bounds = new Box3();
  const parts: { mesh: Mesh; box: Box3 }[] = [];
  root.traverse(node => {
    if (!(node as Mesh).isMesh) return;
    const mesh = node as Mesh;
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox!.clone().applyMatrix4(new Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
    bounds.union(box); parts.push({ mesh, box });
  });
  const size = bounds.getSize(new Vector3());
  for (const { mesh, box } of parts) {
    const part = box.getSize(new Vector3());
    const wide = part.x > size.x * .65;
    const aboveBase = box.max.y > bounds.min.y + .16;
    const front = box.min.z > bounds.max.z - .07 && part.z < .08;
    const upperDrawer = box.min.y > bounds.max.y - .23 && part.y < .23;
    const topRail = box.min.y > bounds.max.y - .05 && part.y < .04 && !front;
    const rearSinkRail = topRail && box.min.z < bounds.getCenter(new Vector3()).z && box.max.z > bounds.getCenter(new Vector3()).z - .17;
    if (wide && (adaptation === "oven" ? aboveBase : adaptation === "sink" ? (upperDrawer && !topRail) || rearSinkRail : topRail)) {
      mesh.visible = false;
      mesh.userData.applianceOpeningPanel = adaptation;
    }
  }
}
