import { Box3, Group, Mesh, Vector3 } from "three";
import { kitchenSurfaceClassifier } from "./kitchenSurfaceClassification";
import type { KitchenPartMotion } from "./kitchenGlbComposition";
import type {
  KitchenFrontKind,
  KitchenFrontMotionMap,
  KitchenHingeSide,
} from "@/lib/kitchenFrontMotion";

export type KitchenDetectedFront = KitchenPartMotion & {
  key: string;
  kind: KitchenFrontKind;
  hinge?: KitchenHingeSide;
  handles: number;
  corrected: boolean;
};

const HANDLE_NAME = /handle|knob|pull|бариул/i;

/**
 * Finds doors, drawer fronts and their handles in a fully assembled GLB from
 * geometry alone, then adds pivots. Origins are never used: pivots come from
 * each front's bounds. The cached source model stays untouched.
 */
export function prepareKitchenDoorMotion(
  root: Group,
  opening: "doors" | "drawers",
  overrides?: KitchenFrontMotionMap | null,
): KitchenDetectedFront[] {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const classify = kitchenSurfaceClassifier(root);
  const bounds = new Map<Mesh, Box3>();
  const keys = new Map<Mesh, string>();
  const fronts: Mesh[] = [];
  let index = 0;
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    // Keys follow traversal order before anything is reparented.
    keys.set(object, `m${index++}`);
    if (object.userData.kitchenOpeningPart) return;
    object.geometry.computeBoundingBox();
    if (!object.geometry.boundingBox) return;
    bounds.set(
      object,
      object.geometry.boundingBox
        .clone()
        .applyMatrix4(inverse.clone().multiply(object.matrixWorld)),
    );
    const material = Array.isArray(object.material)
      ? object.material[0]
      : object.material;
    if (classify(object, material) === "front") fronts.push(object);
  });
  if (!fronts.length) return [];
  const cabinet = new Box3();
  bounds.forEach((box) => cabinet.union(box));
  const centre = cabinet.getCenter(new Vector3());
  const size = cabinet.getSize(new Vector3());

  // A handle is named as one, or is a small part standing proud of a front.
  const handles = new Map<Mesh, Mesh[]>();
  for (const [mesh, box] of bounds) {
    if (fronts.includes(mesh)) continue;
    const part = box.getSize(new Vector3());
    const at = box.getCenter(new Vector3());
    const name = `${mesh.name} ${(Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((m) => m.name).join(" ")}`;
    const named = HANDLE_NAME.test(name);
    if (!named && (part.x > 0.6 || part.y > 0.6 || part.z > 0.08)) continue;
    const owner = fronts
      .filter((front) => {
        const face = bounds.get(front)!;
        const proud = box.max.z - face.max.z;
        return (
          at.x >= face.min.x - 0.03 &&
          at.x <= face.max.x + 0.03 &&
          at.y >= face.min.y - 0.03 &&
          at.y <= face.max.y + 0.03 &&
          (named
            ? at.z >= face.min.z - 0.03
            : proud >= 0.003 && proud <= 0.08 && box.min.z >= face.min.z)
        );
      })
      .sort(
        (a, b) =>
          bounds.get(a)!.distanceToPoint(at) -
          bounds.get(b)!.distanceToPoint(at),
      )[0];
    if (owner) handles.set(owner, [...(handles.get(owner) ?? []), mesh]);
  }

  const result: KitchenDetectedFront[] = [];
  fronts.forEach((front) => {
    const key = keys.get(front)!;
    const box = bounds.get(front)!;
    const face = box.getSize(new Vector3());
    const at = box.getCenter(new Vector3());
    const own = handles.get(front) ?? [];
    // Low, wide fronts are drawers; a "doors" variant keeps every front a door.
    const detectedKind: KitchenFrontKind =
      opening === "drawers" &&
      (face.y < 0.4 || face.x >= face.y * 1.4)
        ? "drawer"
        : "door";
    // The hinge sits opposite the handle; without one, beside the cabinet edge.
    const handleX = own.length
      ? own
          .reduce(
            (sum, mesh) => sum.add(bounds.get(mesh)!.getCenter(new Vector3())),
            new Vector3(),
          )
          .divideScalar(own.length).x
      : null;
    const detectedHinge: KitchenHingeSide =
      handleX !== null && Math.abs(handleX - at.x) > face.x * 0.1
        ? handleX > at.x
          ? "left"
          : "right"
        : fronts.length === 1 || at.x < centre.x
          ? "left"
          : "right";
    const override = overrides?.[key];
    const kind = override?.kind ?? detectedKind;
    const hinge =
      kind === "door" ? (override?.hinge ?? detectedHinge) : undefined;
    const pivot = new Group();
    pivot.name = `Kitchen-opening-${result.length + 1}`;
    pivot.position.set(
      kind === "door" ? (hinge === "left" ? box.min.x : box.max.x) : at.x,
      at.y,
      box.min.z,
    );
    root.add(pivot);
    for (const part of [front, ...own]) {
      pivot.attach(part);
      part.userData.kitchenOpeningPart = true;
    }
    pivot.userData.kitchenFrontKey = key;
    result.push({
      key,
      kind,
      hinge,
      handles: own.length,
      corrected: Boolean(override),
      object: pivot,
      motion:
        kind === "drawer"
          ? { type: "slide", axis: "z", amount: Math.min(450, size.z * 700) }
          : kind === "door"
            ? { type: "hinge", axis: "y", amount: hinge === "left" ? -90 : 90 }
            : { type: "slide", axis: "z", amount: 0 },
      closedPosition: pivot.position.toArray(),
    });
  });
  return result.sort((a, b) => {
    const pa = a.object.position,
      pb = b.object.position;
    return Math.abs(pb.y - pa.y) > 0.05 ? pb.y - pa.y : pa.x - pb.x;
  });
}
