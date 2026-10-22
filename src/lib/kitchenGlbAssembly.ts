/** Authored GLB parts. All stored distances are mm; angles are degrees. */
export const KITCHEN_PART_KINDS = ["door", "drawer-front", "handle", "countertop", "legs", "cover-panel", "filler", "frame", "shelf", "drawer", "appliance", "accessory"] as const;
export type KitchenPartKind = typeof KITCHEN_PART_KINDS[number];
export type KitchenPartVector = [number, number, number];
export type KitchenGlbOption = {
  id: string; label: string; modelId: string; style?: string; color?: string;
  sizeMm?: { width: number; height: number; depth: number };
  offsetMm?: KitchenPartVector; rotationDeg?: KitchenPartVector;
  /** Resolved by the catalog server, never accepted from an admin request. */
  glbFile?: string | null; glbUrl?: string | null; thumbnailUrl?: string | null;
  productId?: string;
};
export type KitchenGlbSlot = {
  id: string; label: string; kind: KitchenPartKind; parentSlotId?: string; anchorNode?: string;
  positionMm: KitchenPartVector; rotationDeg: KitchenPartVector; scale: KitchenPartVector;
  hideNodes: string[]; optional: boolean; defaultOptionId: string; options: KitchenGlbOption[];
  motion?: { type: "hinge" | "slide"; axis: "x" | "y" | "z"; amount: number; pivotMm?: KitchenPartVector };
};
export type KitchenGlbAssembly = { version: 1; slots: KitchenGlbSlot[]; openAnimation?: string };
export class KitchenAssemblyInputError extends Error {}
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (message: string): never => { throw new KitchenAssemblyInputError(message); };
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : fail("Эд ангийн тохиргоо объект байна.");
const label = (value: unknown, name: string, max = 120) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= max ? value.trim() : fail(`${name}: 1–${max} тэмдэгт оруулна уу.`);
const id = (value: unknown) => typeof value === "string" && ID.test(value) ? value : fail("Slot / option code буруу байна.");
const vector = (value: unknown, fallback: KitchenPartVector, max: number, positive = false): KitchenPartVector => {
  if (value === undefined) return [...fallback];
  if (!Array.isArray(value) || value.length !== 3 || !value.every(n => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= max && (!positive || n > 0))) fail("X, Y, Z утгууд буруу байна.");
  return [...value as KitchenPartVector];
};

export function parseKitchenGlbAssembly(value: unknown, hydrated = false): KitchenGlbAssembly {
  const raw = object(value);
  if (raw.version !== 1 || !Array.isArray(raw.slots) || raw.slots.length > 32) fail("Assembly version 1, хамгийн ихдээ 32 эд анги байна.");
  const slots = (raw.slots as unknown[]).map((entry): KitchenGlbSlot => {
    const slot = object(entry);
    if (!(KITCHEN_PART_KINDS as readonly unknown[]).includes(slot.kind)) fail("Эд ангийн төрөл буруу байна.");
    if (!Array.isArray(slot.options) || !slot.options.length || slot.options.length > 40) fail("Эд анги бүр 1–40 GLB сонголттой байна.");
    const options = (slot.options as unknown[]).map((entry): KitchenGlbOption => {
      const option = object(entry);
      if (typeof option.modelId !== "string" || !UUID.test(option.modelId)) fail("Эд ангийн GLB model ID буруу байна.");
      const result: KitchenGlbOption = { id: id(option.id), label: label(option.label, "Сонголтын нэр"), modelId: option.modelId as string };
      for (const key of ["style", "color"] as const) if (option[key] !== undefined) result[key] = label(option[key], key, 80);
      if (option.sizeMm !== undefined) {
        const size = object(option.sizeMm);
        if (![size.width, size.height, size.depth].every(n => typeof n === "number" && Number.isFinite(n) && n > 0 && n <= 10000)) fail("Эд ангийн хэмжээ 0–10000 мм байна.");
        result.sizeMm = { width: size.width as number, height: size.height as number, depth: size.depth as number };
      }
      if (option.offsetMm !== undefined) result.offsetMm = vector(option.offsetMm, [0, 0, 0], 10000);
      if (option.rotationDeg !== undefined) result.rotationDeg = vector(option.rotationDeg, [0, 0, 0], 360);
      if (hydrated) for (const key of ["glbFile", "glbUrl", "thumbnailUrl"] as const) if (typeof option[key] === "string" || option[key] === null) result[key] = option[key];
      if (hydrated && typeof option.productId === "string") result.productId = option.productId;
      return result;
    });
    if (new Set(options.map(option => option.id)).size !== options.length) fail("Нэг эд ангийн сонголтын code давхардахгүй байна.");
    const defaultOptionId = slot.defaultOptionId === "" && slot.optional === true ? "" : id(slot.defaultOptionId);
    if (defaultOptionId && !options.some(option => option.id === defaultOptionId)) fail("Үндсэн GLB сонголт олдсонгүй.");
    if (slot.hideNodes !== undefined && (!Array.isArray(slot.hideNodes) || slot.hideNodes.length > 32)) fail("Нуух node жагсаалт буруу байна.");
    const result: KitchenGlbSlot = {
      id: id(slot.id), label: label(slot.label, "Эд ангийн нэр"), kind: slot.kind as KitchenPartKind,
      positionMm: vector(slot.positionMm, [0, 0, 0], 10000), rotationDeg: vector(slot.rotationDeg, [0, 0, 0], 360), scale: vector(slot.scale, [1, 1, 1], 10, true),
      hideNodes: ((slot.hideNodes ?? []) as unknown[]).map(node => label(node, "Node", 128)), optional: slot.optional === true,
      defaultOptionId, options,
    };
    if (slot.parentSlotId) result.parentSlotId = id(slot.parentSlotId);
    if (slot.anchorNode) result.anchorNode = label(slot.anchorNode, "Anchor node", 128);
    if (slot.motion !== undefined) {
      const motion = object(slot.motion);
      if (!["hinge", "slide"].includes(String(motion.type)) || !["x", "y", "z"].includes(String(motion.axis)) || typeof motion.amount !== "number" || !Number.isFinite(motion.amount) || Math.abs(motion.amount) > (motion.type === "hinge" ? 180 : 2000)) fail("Нээх хөдөлгөөний хэмжээ буруу байна.");
      result.motion = { type: motion.type as "hinge" | "slide", axis: motion.axis as "x" | "y" | "z", amount: motion.amount as number, ...(motion.pivotMm !== undefined ? { pivotMm: vector(motion.pivotMm, [0, 0, 0], 10000) } : {}) };
    }
    return result;
  });
  const byId = new Map(slots.map(slot => [slot.id, slot]));
  if (byId.size !== slots.length) fail("Эд ангийн slot code давхардаж байна.");
  for (const slot of slots) {
    const visited = new Set([slot.id]); let parent = slot.parentSlotId;
    while (parent) {
      if (visited.has(parent) || !byId.has(parent)) fail("Parent slot олдохгүй эсвэл хоорондоо тойрог холбоостой байна.");
      visited.add(parent); parent = byId.get(parent)!.parentSlotId;
    }
  }
  const result: KitchenGlbAssembly = { version: 1, slots, ...(raw.openAnimation ? { openAnimation: label(raw.openAnimation, "Animation", 128) } : {}) };
  if (!hydrated && new TextEncoder().encode(JSON.stringify(result)).length > 45000) fail("Эд ангийн тохиргоо 45 KB-аас ихгүй байна.");
  return result;
}

export function getKitchenGlbAssembly(configuration: unknown): KitchenGlbAssembly | null {
  try { const raw = object(configuration); return raw.assembly ? parseKitchenGlbAssembly(raw.assembly, true) : null; } catch { return null; }
}
export function resolveKitchenPartOption(slot: KitchenGlbSlot, selections?: Record<string, string>): KitchenGlbOption | undefined {
  const chosen = selections?.[slot.id];
  if (slot.optional && chosen === "") return undefined;
  return slot.options.find(option => option.id === chosen) ?? slot.options.find(option => option.id === slot.defaultOptionId);
}
export function parseKitchenPartSelections(value: unknown): Record<string, string> {
  const raw = object(value);
  if (Object.keys(raw).length > 32) fail("Хэт олон эд анги сонгосон байна.");
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [id(key), value === "" ? "" : id(value)]));
}
export function kitchenPartKind(specifications: unknown): KitchenPartKind | null {
  if (!specifications || typeof specifications !== "object" || Array.isArray(specifications)) return null;
  const type = (specifications as Record<string, unknown>).type;
  return typeof type === "string" && type.startsWith("kitchen-part:") && (KITCHEN_PART_KINDS as readonly string[]).includes(type.slice(13)) ? type.slice(13) as KitchenPartKind : null;
}
