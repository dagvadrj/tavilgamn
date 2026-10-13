import { Group, MathUtils, type Object3D } from "three";
import {
  resolveKitchenPartOption,
  type KitchenGlbAssembly,
  type KitchenGlbSlot,
} from "@/lib/kitchenGlbAssembly";

export type KitchenPartMotion = {
  object: Group;
  motion: NonNullable<KitchenGlbSlot["motion"]>;
  closedPosition: [number, number, number];
};

/** All part origins remain authored. Nothing is independently centered or stretched. */
export function composeKitchenGlb(
  frame: Group,
  assembly: KitchenGlbAssembly,
  selections: Record<string, string> | undefined,
  parts: Map<string, Group>,
  frameOffset: [number, number, number],
) {
  const root = new Group();
  root.name = "Kitchen GLB assembly";
  frame.position.x += frameOffset[0];
  frame.position.y += frameOffset[1];
  frame.position.z += frameOffset[2];
  root.add(frame);
  const attached = new Map<string, Group>();
  const motions: KitchenPartMotion[] = [];
  const waiting = [...assembly.slots];
  const removed = new Set<string>();

  while (waiting.length) {
    const index = waiting.findIndex((slot) => !slot.parentSlotId || attached.has(slot.parentSlotId) || removed.has(slot.parentSlotId));
    if (index < 0) throw new Error("Хэсгийн холболт давхар тойрог үүсгэсэн байна.");
    const [slot] = waiting.splice(index, 1);
    if (slot.parentSlotId && removed.has(slot.parentSlotId)) {
      removed.add(slot.id);
      continue;
    }
    const parentAsset = slot.parentSlotId ? attached.get(slot.parentSlotId)! : frame;
    for (const name of slot.hideNodes ?? []) {
      const embedded = parentAsset.getObjectByName(name);
      if (embedded) embedded.visible = false;
    }
    const option = resolveKitchenPartOption(slot, selections);
    if (!option) {
      removed.add(slot.id);
      continue;
    }
    const part = parts.get(slot.id);
    if (!part) throw new Error(`${slot.label}: 3D файл олдсонгүй.`);
    let anchor: Object3D = slot.parentSlotId ? parentAsset : root;
    if (slot.anchorNode) {
      const socket = parentAsset.getObjectByName(slot.anchorNode);
      if (!socket) throw new Error(`${slot.label}: “${slot.anchorNode}” холбох цэг олдсонгүй.`);
      anchor = socket;
    }
    const mount = new Group();
    mount.name = `Slot-${slot.id}`;
    mount.position.fromArray((slot.positionMm ?? [0, 0, 0]).map((value) => value / 1000));
    mount.rotation.set(...(slot.rotationDeg ?? [0, 0, 0]).map(MathUtils.degToRad) as [number, number, number]);
    mount.scale.fromArray(slot.scale ?? [1, 1, 1]);
    const hinge = new Group();
    hinge.name = `Motion-${slot.id}`;
    const pivot = slot.motion?.pivotMm ?? [0, 0, 0];
    hinge.position.fromArray(pivot.map((value) => value / 1000));
    const origin = new Group();
    origin.position.fromArray(pivot.map((value) => -value / 1000));
    part.position.fromArray((option.offsetMm ?? [0, 0, 0]).map((value) => value / 1000));
    part.rotation.set(...(option.rotationDeg ?? [0, 0, 0]).map(MathUtils.degToRad) as [number, number, number]);
    origin.add(part);
    hinge.add(origin);
    mount.add(hinge);
    anchor.add(mount);
    attached.set(slot.id, part);
    if (slot.motion) motions.push({ object: hinge, motion: slot.motion, closedPosition: hinge.position.toArray() });
  }
  root.updateMatrixWorld(true);
  return { root, motions };
}

export function setKitchenGlbOpen(motions: KitchenPartMotion[], open: boolean) {
  for (const { object, motion, closedPosition } of motions) {
    object.position.fromArray(closedPosition);
    object.rotation.set(0, 0, 0);
    if (motion.type === "hinge") object.rotation[motion.axis] = open ? MathUtils.degToRad(motion.amount) : 0;
    else object.position[motion.axis] += open ? motion.amount / 1000 : 0;
  }
}
