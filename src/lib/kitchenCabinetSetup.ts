import type {
  KitchenCatalogModule,
  KitchenModelCandidate,
} from "./kitchenModuleCatalog";
import type {
  KitchenGlbAssembly,
  KitchenGlbSlot,
  KitchenPartVector,
} from "./kitchenGlbAssembly";

const FRONT_SLOT = /^(door-(left|right)|drawer-\d+)$/;
export function cabinetSetupAssembly(
  current: KitchenGlbAssembly | null,
  doors: number,
  drawers: number,
  size: Pick<KitchenCatalogModule, "widthMm" | "heightMm" | "depthMm">,
): KitchenGlbAssembly {
  const slots: KitchenGlbSlot[] = [];
  const create = (
    id: string,
    label: string,
    kind: KitchenGlbSlot["kind"],
    positionMm: KitchenPartVector,
    motion: KitchenGlbSlot["motion"],
  ): KitchenGlbSlot => {
    const existing = current?.slots.find((slot) => slot.id === id);
    // Labels follow the current door count; placement edits are kept.
    return existing ? { ...existing, label, ...(existing.options.length === 1 && !existing.options[0].modelId ? { options: [{ ...existing.options[0], label }] } : {}) } : {
      id,
      label,
      kind,
      positionMm,
      rotationDeg: [0, 0, 0],
      scale: [1, 1, 1],
      hideNodes: [],
      optional: false,
      defaultOptionId: "default",
      options: [{ id: "default", label, modelId: "" }],
      motion,
    };
  };
  for (let i = 0; i < doors; i++) {
    const side = i === 0 ? "left" : "right";
    slots.push(
      create(
        `door-${side}`,
        doors === 1 ? "Хаалга" : i === 0 ? "Зүүн хаалга" : "Баруун хаалга",
        "door",
        [
          i === 0 ? -size.widthMm / 2 : size.widthMm / 2,
          size.heightMm / 2,
          size.depthMm / 2,
        ],
        {
          type: "hinge",
          axis: "y",
          amount: i === 0 ? -100 : 100,
          pivotMm: [0, 0, 0],
        },
      ),
    );
  }
  for (let i = 0; i < drawers; i++)
    slots.push(
      create(
        `drawer-${i + 1}`,
        `Шургуулга ${i + 1}`,
        "drawer-front",
        [
          0,
          size.heightMm -
            ((i + 0.5) * size.heightMm) / (drawers + (doors ? 1 : 0)),
          size.depthMm / 2,
        ],
        { type: "slide", axis: "z", amount: 400, pivotMm: [0, 0, 0] },
      ),
    );
  const ids = new Set(slots.map((slot) => slot.id));
  const extras = (current?.slots ?? []).filter(
    (slot) =>
      !FRONT_SLOT.test(slot.id) &&
      !["door", "drawer", "drawer-front"].includes(slot.kind),
  );
  // Keep existing accessory configuration only while its parent still exists.
  while (extras.length) {
    const index = extras.findIndex(
      (slot) => !slot.parentSlotId || ids.has(slot.parentSlotId),
    );
    if (index < 0) break;
    const [slot] = extras.splice(index, 1);
    const front = slots.find((item) => item.id === slot.parentSlotId);
    slots.push(
      slot.kind === "handle" && front && slot.id === handleSlotId(front.id)
        ? { ...slot, label: handleLabel(front) }
        : slot,
    );
    ids.add(slot.id);
  }
  return {
    version: 1,
    ...(current?.openAnimation ? { openAnimation: current.openAnimation } : {}),
    slots,
  };
}

const HANDLE_INSET_MM = 40;
export const handleSlotId = (frontId: string) => `handle-${frontId}`;
const handleLabel = (front: KitchenGlbSlot) => `${front.label} · бариул`;

/**
 * Handle mount in its front's local frame (mm). Doors hinge at their origin
 * and extend toward the cabinet centre — a mirrored right door reuses the left
 * door's frame — so the handle goes to the free edge, near the top of a base
 * or tall unit and near the bottom of a wall unit. Drawer handles are centred.
 */
export function handleMount(front: KitchenGlbSlot, upper: boolean): KitchenPartVector {
  const size = front.options.find((option) => option.id === front.defaultOptionId)?.sizeMm;
  if (!size) return [0, 0, 0];
  const z = size.depth / 2;
  if (front.kind !== "door") return [0, 0, z];
  const towardCentre = -Math.sign(front.positionMm[0] || -1) * Math.sign(front.scale[0]);
  const x = towardCentre * Math.max(0, size.width - HANDLE_INSET_MM);
  const y = (upper ? -1 : 1) * Math.max(0, size.height / 2 - HANDLE_INSET_MM * 2);
  return [x, y, z];
}

/**
 * Adds (or rebinds) one front's handle, placed automatically. `null` removes
 * it; no model keeps an empty slot for a GLB that is still being uploaded.
 */
export function bindFrontHandle(
  assembly: KitchenGlbAssembly,
  frontId: string,
  model: KitchenModelCandidate | null | undefined,
  upper: boolean,
): KitchenGlbAssembly {
  const front = assembly.slots.find((slot) => slot.id === frontId);
  if (!front) return assembly;
  const id = handleSlotId(frontId);
  const existing = assembly.slots.find((slot) => slot.id === id);
  const rest = assembly.slots.filter((slot) => slot.id !== id);
  if (model === null) return { ...assembly, slots: rest };
  const slot: KitchenGlbSlot = existing ?? {
    id,
    label: handleLabel(front),
    kind: "handle",
    parentSlotId: frontId,
    positionMm: handleMount(front, upper),
    rotationDeg: [0, 0, 0],
    scale: [1, 1, 1],
    hideNodes: [],
    optional: true,
    defaultOptionId: "default",
    options: [{ id: "default", label: handleLabel(front), modelId: "" }],
  };
  const next = { ...assembly, slots: [...rest, slot] };
  return model ? bindCabinetPart(next, id, model) : next;
}

/** Re-places a front's handle after the front itself changed (new GLB or mirroring). */
export function placeFrontHandle(
  assembly: KitchenGlbAssembly,
  frontId: string,
  upper: boolean,
): KitchenGlbAssembly {
  const front = assembly.slots.find((slot) => slot.id === frontId);
  const id = handleSlotId(frontId);
  if (!front) return assembly;
  return {
    ...assembly,
    slots: assembly.slots.map((slot) =>
      slot.id === id ? { ...slot, positionMm: handleMount(front, upper) } : slot,
    ),
  };
}

export const FRONT_KINDS: KitchenGlbSlot["kind"][] = ["door", "drawer-front", "drawer"];

/** One handle model on every door and drawer front. */
export function bindAllHandles(
  assembly: KitchenGlbAssembly,
  model: KitchenModelCandidate | null,
  upper: boolean,
): KitchenGlbAssembly {
  return assembly.slots
    .filter((slot) => FRONT_KINDS.includes(slot.kind))
    .reduce((next, front) => bindFrontHandle(next, front.id, model, upper), assembly);
}

export function bindCabinetPart(
  assembly: KitchenGlbAssembly,
  slotId: string,
  model: KitchenModelCandidate,
): KitchenGlbAssembly {
  return {
    ...assembly,
    slots: assembly.slots.map((slot) =>
      slot.id === slotId
        ? {
            ...slot,
            scale: [1, 1, 1],
            ...(slot.scale[0] < 0 &&
            slot.motion?.type === "hinge" &&
            slot.motion.axis === "y"
              ? { motion: { ...slot.motion, amount: -slot.motion.amount } }
              : {}),
            defaultOptionId: "default",
            options: [
              {
                id: "default",
                label: model.name,
                modelId: model.id,
                sizeMm: {
                  width: model.widthMm,
                  height: model.heightMm,
                  depth: model.depthMm,
                },
              },
            ],
          }
        : slot,
    ),
  };
}

export function reuseCabinetPart(
  assembly: KitchenGlbAssembly,
  targetId: string,
  sourceId: string,
  models: KitchenModelCandidate[],
): KitchenGlbAssembly {
  const source = assembly.slots.find((slot) => slot.id === sourceId);
  const option = source?.options.find(
    (item) => item.id === source.defaultOptionId,
  );
  const model = models.find((item) => item.id === option?.modelId);
  if (!source || !model) return assembly;
  const next = bindCabinetPart(assembly, targetId, model);
  return {
    ...next,
    slots: next.slots.map((slot) =>
      slot.id === targetId
        ? {
            ...slot,
            scale:
              slot.kind === "door"
                ? [-source.scale[0], source.scale[1], source.scale[2]]
                : [...source.scale],
            // Reflection reverses world hinge rotation. Matching local angles opens
            // mirrored doors toward the same front side of the cabinet.
            ...(slot.kind === "door" &&
            source.motion?.type === "hinge" &&
            slot.motion
              ? { motion: { ...slot.motion, amount: source.motion.amount } }
              : {}),
          }
        : slot,
    ),
  };
}

export function cabinetSetupProblem(
  assembly: KitchenGlbAssembly,
  models: KitchenModelCandidate[],
) {
  for (const slot of assembly.slots) {
    const choice = slot.options.find(
      (option) => option.id === slot.defaultOptionId,
    );
    if (!choice?.modelId && slot.optional) continue;
    if (!choice?.modelId)
      return `${slot.label}: GLB сонгох эсвэл шинээр оруулна уу.`;
    const model = models.find((model) => model.id === choice.modelId);
    if (!model?.glbReady || model.archivedAt)
      return `${slot.label}: GLB боловсруулалт дуусаагүй эсвэл архивлагдсан байна.`;
    if (
      model.partKind !== slot.kind &&
      !(slot.kind === "drawer-front" && model.partKind === "drawer")
    )
      return `${slot.label}: тохирох төрлийн GLB сонгоно уу.`;
  }
  return null;
}
