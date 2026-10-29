import { Box3, Group, Mesh, Vector3 } from "three";
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
  /** Leaf thickness front to back, for checking a manual slab depth. */
  depthMm: number;
};

const HANDLE_NAME = /handle|knob|pull|бариул/i;

/**
 * Finds door leaves, drawer fronts and their handles in a fully assembled GLB
 * from geometry alone, then adds pivots. A leaf may be built from many meshes
 * (rails, stiles, glass); touching pieces in the front slab are merged into one.
 * Origins are never used: pivots come from each leaf's bounds. The cached
 * source model stays untouched.
 */
export function prepareKitchenDoorMotion(
  root: Group,
  opening: "doors" | "drawers",
  overrides?: KitchenFrontMotionMap | null,
  slabMm?: number | null,
  handleMm?: number | null,
): KitchenDetectedFront[] {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const bounds = new Map<Mesh, Box3>();
  const keys = new Map<Mesh, string>();
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
  });
  if (!bounds.size) return [];
  const cabinet = new Box3();
  bounds.forEach((box) => cabinet.union(box));
  const centre = cabinet.getCenter(new Vector3());
  const size = cabinet.getSize(new Vector3());
  const sizes = new Map(
    [...bounds].map(([mesh, box]) => [mesh, box.getSize(new Vector3())]),
  );
  // The front face is the furthest-forward surface of any part covering at
  // least 2% of the cabinet front (frame rails count, handle bars do not).
  let faceZ = -Infinity;
  for (const [mesh, box] of bounds) {
    const part = sizes.get(mesh)!;
    if (part.x * part.y >= size.x * size.y * 0.02)
      faceZ = Math.max(faceZ, box.max.z);
  }
  if (!Number.isFinite(faceZ)) faceZ = cabinet.max.z;

  const handleMeshes: Mesh[] = [];
  const pieces: Mesh[] = [];
  for (const [mesh, box] of bounds) {
    const part = sizes.get(mesh)!;
    const name = `${mesh.name} ${(Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((m) => m.name).join(" ")}`;
    const small = part.x <= 0.6 && part.y <= 0.6 && part.z <= 0.08;
    const proud = box.max.z - faceZ;
    if (
      handleMm
        ? proud > 0.0005 && proud <= handleMm / 1000 + 0.001
        : (HANDLE_NAME.test(name) || (small && proud > 0.004)) &&
          box.min.z >= faceZ - 0.05
    )
      handleMeshes.push(mesh);
    else if (
      slabMm
        ? box.min.z >= faceZ - slabMm / 1000 - 0.001 &&
          box.max.z >= faceZ - slabMm / 1000
        : part.z <= 0.06 && box.max.z >= faceZ - 0.03
    )
      pieces.push(mesh);
  }

  // Merge pieces that touch side by side within the same depth band.
  const parent = pieces.map((_, i) => i);
  const find = (i: number): number =>
    parent[i] === i ? i : (parent[i] = find(parent[i]));
  const gap = 0.0015;
  for (let a = 0; a < pieces.length; a++)
    for (let b = a + 1; b < pieces.length; b++) {
      const p = bounds.get(pieces[a])!,
        q = bounds.get(pieces[b])!;
      if (
        p.min.x <= q.max.x + gap &&
        q.min.x <= p.max.x + gap &&
        p.min.y <= q.max.y + gap &&
        q.min.y <= p.max.y + gap &&
        p.min.z <= q.max.z + 0.0005 &&
        q.min.z <= p.max.z + 0.0005
      )
        parent[find(a)] = find(b);
    }
  const groups = new Map<number, Mesh[]>();
  pieces.forEach((mesh, i) =>
    groups.set(find(i), [...(groups.get(find(i)) ?? []), mesh]),
  );
  const leaves = [...groups.values()]
    .map((meshes) => {
      const box = new Box3();
      meshes.forEach((mesh) => box.union(bounds.get(mesh)!));
      return { meshes, box };
    })
    .filter(({ box }) => {
      const leaf = box.getSize(new Vector3());
      return leaf.x >= size.x * 0.12 && leaf.y >= size.y * 0.12;
    });
  if (!leaves.length) return [];

  const handles = new Map<(typeof leaves)[number], Mesh[]>();
  for (const mesh of handleMeshes) {
    const at = bounds.get(mesh)!.getCenter(new Vector3());
    const owner = leaves
      .filter(
        ({ box }) =>
          at.x >= box.min.x - 0.03 &&
          at.x <= box.max.x + 0.03 &&
          at.y >= box.min.y - 0.03 &&
          at.y <= box.max.y + 0.03,
      )
      .sort((a, b) => a.box.distanceToPoint(at) - b.box.distanceToPoint(at))[0];
    if (owner) handles.set(owner, [...(handles.get(owner) ?? []), mesh]);
  }

  const result: KitchenDetectedFront[] = [];
  for (const leaf of leaves) {
    const { box, meshes } = leaf;
    const key = meshes
      .map((mesh) => keys.get(mesh)!)
      .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))[0];
    const face = box.getSize(new Vector3());
    const at = box.getCenter(new Vector3());
    const own = handles.get(leaf) ?? [];
    // Low, wide fronts are drawers; a "doors" variant keeps every front a door.
    const detectedKind: KitchenFrontKind =
      opening === "drawers" && (face.y < 0.4 || face.x >= face.y * 1.4)
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
        : leaves.length === 1 || at.x < centre.x
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
    for (const part of [...meshes, ...own]) {
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
      depthMm: Math.round(face.z * 1000),
      object: pivot,
      motion:
        kind === "drawer"
          ? { type: "slide", axis: "z", amount: Math.min(450, size.z * 700) }
          : kind === "door"
            ? { type: "hinge", axis: "y", amount: hinge === "left" ? -90 : 90 }
            : { type: "slide", axis: "z", amount: 0 },
      closedPosition: pivot.position.toArray(),
    });
  }
  return result.sort((a, b) => {
    const pa = a.object.position,
      pb = b.object.position;
    return Math.abs(pb.y - pa.y) > 0.05 ? pb.y - pa.y : pa.x - pb.x;
  });
}
