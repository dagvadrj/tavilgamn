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
  ): KitchenGlbSlot =>
    current?.slots.find((slot) => slot.id === id) ?? {
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
    slots.push(slot);
    ids.add(slot.id);
  }
  return {
    version: 1,
    ...(current?.openAnimation ? { openAnimation: current.openAnimation } : {}),
    slots,
  };
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
