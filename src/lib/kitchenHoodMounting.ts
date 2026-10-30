import type {
  CabinetPose,
  ModularCabinet,
  ModularKitchen,
} from "./kitchenCabinets";
import type { KitchenExtra } from "./kitchenExtras";
import {
  PCMALL_APPLIANCES,
  pcmallAppliance,
  pcmallProductId,
} from "./pcmallAppliances";

export type KitchenHoodMount = { kind: "under-cabinet"; cabinetId: string };

/** Keep real size: flush fronts when the hood fits the depth; deeper hoods project forward, never through the wall. */
export function hoodMountPosition(
  box: Pick<ModularCabinet, "depth" | "position">,
  hood: Pick<KitchenExtra, "height" | "depth">,
): CabinetPose {
  const offset = Math.abs(hood.depth - box.depth) / 2;
  return {
    x: box.position.x + Math.sin(box.position.rotation) * offset,
    z: box.position.z + Math.cos(box.position.rotation) * offset,
    y: box.position.y - hood.height,
    rotation: box.position.rotation,
  };
}

export function hoodFitsCabinet(
  hood: KitchenExtra,
  box: ModularCabinet,
): boolean {
  return (
    hood.asset?.type === "hood" &&
    box.type === "wall" &&
    !box.corner &&
    !["hood", "refrigerator"].includes(box.opening ?? "") &&
    hood.width <= box.width &&
    box.position.y >= hood.height
  );
}

/** Address the box, not a one-time world position, so moving/resizing it retains the mount. */
export function resolveKitchenHoodMounts(
  kitchen: ModularKitchen,
): ModularKitchen {
  let changed = false;
  const extras = kitchen.extras?.map((extra) => {
    if (!extra.mount) return extra;
    const box = kitchen.cabinets.find((c) => c.id === extra.mount?.cabinetId);
    if (!box || !hoodFitsCabinet(extra, box)) return extra; // Validation reports broken mounts.
    const position = hoodMountPosition(box, extra);
    if (
      Object.keys(position).every(
        (key) =>
          Math.abs(
            position[key as keyof CabinetPose] -
              extra.position[key as keyof CabinetPose],
          ) < 1e-6,
      )
    )
      return extra;
    changed = true;
    return { ...extra, position };
  });
  return changed ? { ...kitchen, extras } : kitchen;
}

/** Upgrade the former box+hood object without replacing its authored cabinet GLB. */
export function separateKitchenHoods(kitchen: ModularKitchen): ModularKitchen {
  const extras = [...(kitchen.extras ?? [])];
  let changed = false;
  const cabinets = kitchen.cabinets.map((box, index) => {
    if (
      box.catalogAdaptation !== "hood" ||
      !box.variantId ||
      box.hoodMount !== "under-cabinet"
    )
      return box;
    const item = box.applianceProductId
      ? pcmallAppliance(box.applianceProductId)
      : PCMALL_APPLIANCES.find((a) => a.type === "hood");
    if (!item || item.type !== "hood" || extras.length >= 40) return box;
    const prefix = `hood-${index}-${box.id}`.slice(0, 70);
    let id = prefix,
      serial = 0;
    while ([...kitchen.cabinets, ...extras].some((e) => e.id === id))
      id = `${prefix}-${++serial}`;
    const {
      hoodMount: _hood,
      catalogAdaptation: _adaptation,
      applianceProductId: _appliance,
      ...body
    } = box;
    const host: ModularCabinet = {
      ...body,
      opening: "doors",
      autoElevation: true,
    };
    extras.push({
      id,
      productId: pcmallProductId(item),
      name: item.name,
      category: "kitchen-cabinet",
      width: item.width,
      height: item.height,
      depth: item.depth,
      color: item.color,
      material: "metal",
      model: { id: item.id, file: "hood.glb", scale: 1 },
      asset: {
        version: 1,
        type: "hood",
        installation: "freestanding",
        placement: "wall",
      },
      mount: { kind: "under-cabinet", cabinetId: host.id },
      position: hoodMountPosition(host, item),
    });
    changed = true;
    return host;
  });
  return changed ? { ...kitchen, cabinets, extras } : kitchen;
}

/** A drag attracts only nearby, wide-enough boxes; a 90-degree return gets its own orientation. */
export function snapKitchenHood(
  kitchen: ModularKitchen,
  hood: KitchenExtra,
  requested = hood.position,
  anywhere = false,
): KitchenExtra | null {
  if (hood.asset?.type !== "hood") return null;
  const occupied = new Set(
    kitchen.extras
      ?.filter((e) => e.id !== hood.id && e.mount)
      .map((e) => e.mount!.cabinetId),
  );
  const candidates = kitchen.cabinets
    .filter((box) => hoodFitsCabinet(hood, box) && !occupied.has(box.id))
    .map((box) => {
      const position = hoodMountPosition(box, hood),
        dx = requested.x - position.x,
        dz = requested.z - position.z;
      const along =
        dx * Math.cos(box.position.rotation) -
        dz * Math.sin(box.position.rotation);
      const across =
        dx * Math.sin(box.position.rotation) +
        dz * Math.cos(box.position.rotation);
      return {
        box,
        position,
        score: Math.hypot(dx, dz),
        near: Math.abs(along) <= box.width / 2 + 100 && Math.abs(across) <= 180,
      };
    })
    .filter((c) => anywhere || c.near)
    .sort((a, b) => a.score - b.score);
  const candidate = candidates[0];
  return candidate
    ? {
        ...hood,
        position: candidate.position,
        mount: { kind: "under-cabinet", cabinetId: candidate.box.id },
      }
    : null;
}
