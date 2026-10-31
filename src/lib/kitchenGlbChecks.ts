/**
 * Manufacturing checks for modules read from a full-kitchen GLB. A factory cuts
 * boards from these sizes, so every size carries how it was measured and every
 * doubtful one is flagged for the merchant to re-check by hand.
 * Units: millimetres, Y up.
 */
import {
  KITCHEN_GLB_ROLE_LABELS,
  kitchenGlbCurved,
  kitchenGlbModuleName,
  kitchenGlbRoleOf,
  type KitchenGlbBox,
  type KitchenGlbDetection,
  type KitchenGlbMeasured,
  type KitchenGlbModule,
  type KitchenGlbModuleRole,
  type KitchenGlbPart,
} from "./kitchenGlbModules";
import {
  KITCHEN_GLB_APPLIANCE_LABELS,
  kitchenGlbGrowCabinet,
  kitchenGlbUnion,
} from "./kitchenGlbCarcass";
import type { KitchenGlbSlots } from "./kitchenMarketplace";

const BOARD = 25;
const size = (box: KitchenGlbBox) =>
  box.max.map((value, axis) => value - box.min[axis]) as [
    number,
    number,
    number,
  ];
const round = (value: number) => Math.round(value);
const isBoard = (part: KitchenGlbPart) => Math.min(...size(part.box)) <= BOARD;
const depthAxisOf = (cabinet: KitchenGlbModule): 0 | 2 =>
  cabinet.facing[1] === "x" ? 0 : 2;

/** Plausible carcass sizes; outside them a size is almost surely misread. */
const PLAUSIBLE: Record<
  KitchenGlbModuleRole,
  Record<"width" | "height" | "depth", [number, number]>
> = {
  base: { width: [150, 1200], height: [600, 950], depth: [280, 700] },
  // Uppers over a fridge are built as deep as the fridge.
  wall: { width: [150, 1200], height: [250, 1800], depth: [150, 650] },
  tall: { width: [150, 1200], height: [1500, 2900], depth: [280, 700] },
};

/**
 * Re-measures modules found from their fronts against the carcass behind
 * them. Fronts are a few mm narrower than the body and give no depth, so the
 * carcass (sides, top, back) is the size a factory needs. Boards of the found
 * carcass join the cabinet, so clicks and colours cover the whole cabinet.
 */
export function kitchenGlbMeasureModules(
  detection: KitchenGlbDetection,
  parts: readonly KitchenGlbPart[],
): KitchenGlbDetection {
  const byId = new Map(parts.map((part) => [part.id, part]));
  const excluded = new Set([
    ...(detection.countertopParts ?? []),
    ...(detection.appliances ?? []).flatMap((item) => item.parts),
  ]);
  const claimed = new Set<number>();
  // A carcass exported as one mesh (all boards in one node) behind the fronts.
  const composite = new Map<number, number>();
  const solids = parts.filter(
    (part) =>
      !isBoard(part) &&
      !excluded.has(part.id) &&
      !kitchenGlbCurved(part) &&
      part.thicknessMm !== undefined,
  );
  type Measured = KitchenGlbModule | { merge: number; into: KitchenGlbModule };
  const measuredModules = detection.modules.map((cabinet): Measured => {
    const own = cabinet.parts
      .map((id) => byId.get(id))
      .filter((part): part is KitchenGlbPart => !!part);
    // A cabinet modelled as one solid box is measured by that box.
    if (own.length && !isBoard(own[0]))
      return {
        ...cabinet,
        measured: cabinet.measured ?? {
          width: "solid",
          height: "solid",
          depth: "solid",
        },
      } satisfies KitchenGlbModule;
    const axis = depthAxisOf(cabinet);
    const along = axis === 0 ? 2 : 0;
    const frontSpan = cabinet.box.max[along] - cabinet.box.min[along];
    // The first front whose carcass fits this cabinet's span decides.
    const frontMin = cabinet.box.min[along];
    const frontMax = cabinet.box.max[along];
    for (const seed of own) {
      const carcass = kitchenGlbGrowCabinet(seed, parts, excluded);
      if (!carcass) continue;
      // End panels and fillers joined to the side are not part of this body.
      const body = carcass.parts.filter((id) => {
        const part = byId.get(id)!;
        return (
          !cabinet.parts.includes(id) &&
          !claimed.has(id) &&
          part.box.min[along] >= frontMin - 12 &&
          part.box.max[along] <= frontMax + 12
        );
      });
      if (body.length < 2) continue;
      const bodyBox = kitchenGlbUnion(body.map((id) => byId.get(id)!.box));
      const width = bodyBox.max[along] - bodyBox.min[along];
      const depth = bodyBox.max[axis] - bodyBox.min[axis];
      // A carcass far wider than the fronts is a run-long body, not this unit.
      if (Math.abs(width - frontSpan) > Math.max(60, frontSpan * 0.12))
        continue;
      if (depth < 120 || depth > 750) continue;
      for (const id of body) claimed.add(id);
      const box = kitchenGlbUnion([cabinet.box, bodyBox]);
      // Depth ends at the carcass back, not at the default depth behind fronts.
      box.min[axis] = Math.min(bodyBox.min[axis], ...own.map((p) => p.box.min[axis]));
      box.max[axis] = Math.max(bodyBox.max[axis], ...own.map((p) => p.box.max[axis]));
      return {
        ...cabinet,
        widthMm: round(width),
        heightMm: round(bodyBox.max[1] - bodyBox.min[1]),
        depthMm: round(depth),
        box,
        parts: [...cabinet.parts, ...body],
        measured: { width: "carcass", height: "carcass", depth: "carcass" },
      } satisfies KitchenGlbModule;
    }
    // Failing that, a one-mesh carcass right behind the fronts gives the size.
    const plane =
      cabinet.facing[0] === "+"
        ? Math.max(...own.map((part) => part.box.min[axis]))
        : Math.min(...own.map((part) => part.box.max[axis]));
    const shell = own.length
      ? solids.find((part) => {
          const overlap =
            Math.min(part.box.max[along], frontMax) -
            Math.max(part.box.min[along], frontMin);
          const behind =
            cabinet.facing[0] === "+"
              ? Math.abs(part.box.max[axis] - plane) <= 30
              : Math.abs(part.box.min[axis] - plane) <= 30;
          const [pw, , pd] = size(part.box);
          return (
            behind &&
            overlap >= 0.8 * (frontMax - frontMin) &&
            // One cabinet (a two-door unit is merged below), never a whole run.
            (axis === 0 ? pd : pw) <= 1250 &&
            part.box.min[1] <= cabinet.box.min[1] + 150 &&
            part.box.max[1] >= cabinet.box.max[1] - 150
          );
        })
      : undefined;
    if (shell) {
      const [sw, sh, sd] = size(shell.box);
      const role =
        kitchenGlbRoleOf(shell.box.min[1], shell.box.max[1]) ?? cabinet.role;
      const widthMm = round(axis === 0 ? sd : sw);
      const known = composite.get(shell.id);
      if (known !== undefined) return { merge: known, into: cabinet };
      composite.set(shell.id, detection.modules.indexOf(cabinet));
      return {
        ...cabinet,
        role,
        name:
          cabinet.name === kitchenGlbModuleName(cabinet.role, cabinet.widthMm)
            ? kitchenGlbModuleName(role, widthMm)
            : cabinet.name,
        widthMm,
        heightMm: round(sh),
        depthMm: round(axis === 0 ? sw : sd),
        box: kitchenGlbUnion([shell.box, ...own.map((part) => part.box)]),
        parts: [shell.id, ...cabinet.parts],
        measured: { width: "carcass", height: "carcass", depth: "carcass" },
      } satisfies KitchenGlbModule;
    }
    return {
      ...cabinet,
      measured: cabinet.measured ?? {
        width: "front",
        height: own.length ? "front" : "estimated",
        depth: "estimated",
      },
    } satisfies KitchenGlbModule;
  });
  // A blind corner unit: one door at one end of a wider carcass whose other end
  // is a fixed blind panel. Read only after every plain unit claimed its body,
  // so the extra width can only be boards no neighbour owns.
  const ownedByOthers = (cabinet: KitchenGlbModule) =>
    new Set(
      measuredModules.flatMap((item) =>
        "merge" in item || item === cabinet ? [] : item.parts,
      ),
    );
  const blindCorner = (cabinet: KitchenGlbModule): KitchenGlbModule | null => {
    if (cabinet.measured?.width !== "front") return null;
    const own = cabinet.parts
      .map((id) => byId.get(id))
      .filter((part): part is KitchenGlbPart => !!part && isBoard(part));
    const axis = depthAxisOf(cabinet);
    const along = axis === 0 ? 2 : 0;
    const frontMin = cabinet.box.min[along];
    const frontMax = cabinet.box.max[along];
    const others = ownedByOthers(cabinet);
    for (const seed of own) {
      const carcass = kitchenGlbGrowCabinet(seed, parts, excluded);
      if (!carcass) continue;
      const body = carcass.parts.filter((id) => {
        const part = byId.get(id)!;
        return (
          !cabinet.parts.includes(id) &&
          !claimed.has(id) &&
          !others.has(id) &&
          // A floor-standing end panel closes the run; it is not the carcass.
          (cabinet.role === "wall" || part.box.min[1] >= cabinet.box.min[1] + 50)
        );
      });
      if (body.length < 3) continue;
      const bodyBox = kitchenGlbUnion(body.map((id) => byId.get(id)!.box));
      const width = bodyBox.max[along] - bodyBox.min[along];
      const depth = bodyBox.max[axis] - bodyBox.min[axis];
      const extra = width - (frontMax - frontMin);
      if (extra < 80 || extra > 700 || width > 1250) continue;
      if (depth < 120 || depth > 750) continue;
      const atStart = Math.abs(frontMin - bodyBox.min[along]) <= 40;
      const atEnd = Math.abs(frontMax - bodyBox.max[along]) <= 40;
      if (atStart === atEnd) continue;
      // The blind end must be free floor, not a neighbouring unit.
      const strip: KitchenGlbBox = {
        min: [...bodyBox.min],
        max: [...bodyBox.max],
      };
      if (atStart) strip.min[along] = frontMax;
      else strip.max[along] = frontMin;
      const blocked = measuredModules.some((item) => {
        if ("merge" in item || item === cabinet) return false;
        if ((item.role === "wall") !== (cabinet.role === "wall")) return false;
        return [0, 2].every(
          (index) =>
            Math.min(item.box.max[index], strip.max[index]) -
              Math.max(item.box.min[index], strip.min[index]) >
            50,
        );
      });
      if (blocked) continue;
      for (const id of body) claimed.add(id);
      const box = kitchenGlbUnion([cabinet.box, bodyBox]);
      box.min[axis] = Math.min(bodyBox.min[axis], ...own.map((p) => p.box.min[axis]));
      box.max[axis] = Math.max(bodyBox.max[axis], ...own.map((p) => p.box.max[axis]));
      const widthMm = round(width);
      return {
        ...cabinet,
        name:
          cabinet.name === kitchenGlbModuleName(cabinet.role, cabinet.widthMm)
            ? kitchenGlbModuleName(cabinet.role, widthMm)
            : cabinet.name,
        widthMm,
        heightMm: round(bodyBox.max[1] - bodyBox.min[1]),
        depthMm: round(depth),
        box,
        parts: [...cabinet.parts, ...body],
        measured: { width: "carcass", height: "carcass", depth: "carcass" },
      };
    }
    return null;
  };
  measuredModules.forEach((item, index) => {
    if ("merge" in item) return;
    const corner = blindCorner(item);
    if (corner) measuredModules[index] = corner;
  });
  // Several doors of one one-mesh carcass (a tall unit) are one module.
  const modules: KitchenGlbModule[] = [];
  const at = new Map<number, number>();
  measuredModules.forEach((item, index) => {
    if ("merge" in item) {
      const host = modules[at.get(item.merge)!];
      host.parts = [...new Set([...host.parts, ...item.into.parts])];
      host.box = kitchenGlbUnion([host.box, item.into.box]);
      return;
    }
    at.set(index, modules.length);
    modules.push(item);
  });
  // Parts shared by a run: a plinth hides the legs of every floor unit it runs
  // under, and a carcass exported as one mesh for the whole run holds every
  // cabinet in front of it. Each such part is registered with every cabinet
  // it covers (BOM and click-to-select include it); a run carcass also gives
  // the depth the fronts could only estimate.
  const owned = new Set([...excluded, ...modules.flatMap((item) => item.parts)]);
  for (const part of parts) {
    if (owned.has(part.id) || kitchenGlbCurved(part)) continue;
    const plinth = part.box.min[1] <= 20 && size(part.box)[1] <= 160;
    const covered = modules.filter((cabinet) => {
      if (plinth && cabinet.role === "wall") return false;
      const axis = depthAxisOf(cabinet);
      const along = axis === 0 ? 2 : 0;
      const overlap =
        Math.min(part.box.max[along], cabinet.box.max[along]) -
        Math.max(part.box.min[along], cabinet.box.min[along]);
      const gap = Math.max(
        cabinet.box.min[axis] - part.box.max[axis],
        part.box.min[axis] - cabinet.box.max[axis],
      );
      if (overlap <= 50 || gap > 60) return false;
      if (plinth) return true;
      // A run carcass stays within the cabinets' height and plan.
      return (
        part.box.min[1] >= cabinet.box.min[1] - 40 &&
        part.box.max[1] <= cabinet.box.max[1] + 60 &&
        part.box.min[along] >= Math.min(...modules.map((item) => item.box.min[along])) - 40
      );
    });
    // One cabinet's own loose board is left for the merchant to attach.
    if (!plinth && covered.length < 2) continue;
    for (const cabinet of covered) {
      cabinet.parts = [...cabinet.parts, part.id];
      const axis = depthAxisOf(cabinet);
      const depth = part.box.max[axis] - part.box.min[axis];
      if (plinth || isBoard(part) || cabinet.measured?.depth !== "estimated") continue;
      if (depth < 150 || depth > 750) continue;
      // Depth runs from the front to the back of the run carcass.
      const front = byId.get(cabinet.parts[0])!;
      cabinet.box = { min: [...cabinet.box.min], max: [...cabinet.box.max] };
      cabinet.box.min[axis] = Math.min(part.box.min[axis], front.box.min[axis]);
      cabinet.box.max[axis] = Math.max(part.box.max[axis], front.box.max[axis]);
      cabinet.depthMm = round(cabinet.box.max[axis] - cabinet.box.min[axis]);
      cabinet.measured = { ...cabinet.measured, depth: "carcass" };
    }
  }
  return { ...detection, modules };
}

/**
 * Joins several modules and loose parts into one cabinet (a cabinet the
 * detection split in two, or one it missed). The result is marked merged so
 * its sizes are re-checked.
 */
export function kitchenGlbMergeModules(
  modules: readonly KitchenGlbModule[],
  moduleIds: readonly string[],
  partIds: readonly number[],
  parts: readonly KitchenGlbPart[],
  id: string,
): KitchenGlbModule[] {
  const chosen = modules.filter((item) => moduleIds.includes(item.id));
  const loose = parts.filter((part) => partIds.includes(part.id));
  if (chosen.length + loose.length < 1) return [...modules];
  const box = kitchenGlbUnion([
    ...chosen.map((item) => item.box),
    ...loose.map((part) => part.box),
  ]);
  const [w, h, d] = size(box);
  const facing =
    chosen[0]?.facing ?? (w >= d ? ("+z" as const) : ("+x" as const));
  const axis = facing[1] === "x" ? 0 : 2;
  const role =
    kitchenGlbRoleOf(box.min[1], box.max[1]) ?? chosen[0]?.role ?? "base";
  const widthMm = round(axis === 0 ? d : w);
  const merged: KitchenGlbModule = {
    id,
    role,
    name: kitchenGlbModuleName(role, widthMm),
    widthMm,
    heightMm: round(h),
    depthMm: round(axis === 0 ? w : d),
    box,
    parts: [
      ...new Set([
        ...chosen.flatMap((item) => item.parts),
        ...loose.map((part) => part.id),
      ]),
    ],
    facing,
    manual: true,
    color: chosen[0]?.color,
    finish: chosen[0]?.finish,
    measured: { width: "merged", height: "merged", depth: "merged" },
  };
  const index = modules.findIndex((item) => moduleIds.includes(item.id));
  const rest = modules.filter((item) => !moduleIds.includes(item.id));
  rest.splice(index < 0 ? rest.length : index, 0, merged);
  return rest;
}

export type KitchenGlbIssue = {
  level: "error" | "warning";
  text: string;
  moduleIds: string[];
  /** A suggested correction the merchant can apply (and undo) in one click. */
  fix?: {
    label: string;
    changes: Array<{ id: string; change: Partial<KitchenGlbModule> }>;
  };
};

/** Applies an issue's suggested fix; sizes it sets count as entered by hand. */
export function kitchenGlbApplyFix(
  modules: readonly KitchenGlbModule[],
  fix: NonNullable<KitchenGlbIssue["fix"]>,
): KitchenGlbModule[] {
  const changes = new Map(fix.changes.map((entry) => [entry.id, entry.change]));
  return modules.map((cabinet) => {
    const change = changes.get(cabinet.id);
    if (!change) return cabinet;
    const measured = cabinet.measured && {
      ...cabinet.measured,
      ...("widthMm" in change ? { width: "manual" as const } : {}),
      ...("depthMm" in change ? { depth: "manual" as const } : {}),
    };
    return { ...cabinet, ...change, measured };
  });
}

const MEASURE_LABEL: Record<keyof KitchenGlbMeasured, string> = {
  width: "Өргөн",
  height: "Өндөр",
  depth: "Гүн",
};

/** Doubtful sizes, overlaps, gaps and parts no cabinet covers. */
export function kitchenGlbModuleIssues(
  detection: KitchenGlbDetection,
  parts: readonly KitchenGlbPart[],
): KitchenGlbIssue[] {
  const issues: KitchenGlbIssue[] = [];
  const modules = detection.modules;
  const floor = (item: KitchenGlbModule) => item.role !== "wall";
  const depthAxis = (facing: KitchenGlbModule["facing"]): 0 | 2 =>
    facing[1] === "x" ? 0 : 2;
  /** Cabinets of one row: same level (floor or upper) and facing. */
  const row = (cabinet: KitchenGlbModule) =>
    modules.filter(
      (item) =>
        floor(item) === floor(cabinet) && item.facing === cabinet.facing,
    );
  const median = (values: number[]) =>
    [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  for (const cabinet of modules) {
    const label = cabinet.name;
    const sizes = {
      width: cabinet.widthMm,
      height: cabinet.heightMm,
      depth: cabinet.depthMm,
    };
    for (const key of ["width", "height", "depth"] as const) {
      const [min, max] = PLAUSIBLE[cabinet.role][key];
      if (sizes[key] < min || sizes[key] > max)
        issues.push({
          level: "error",
          text: `${label}: ${MEASURE_LABEL[key].toLowerCase()} ${sizes[key]} мм нь ${KITCHEN_GLB_ROLE_LABELS[cabinet.role].toLowerCase()}нд хэт ${sizes[key] < min ? "бага" : "их"} (${min}–${max} мм). Төрөл эсвэл хэмжээ буруу байж магадгүй.`,
          moduleIds: [cabinet.id],
        });
    }
    // Once the merchant confirmed a cabinet, only impossible sizes are raised.
    const measured = cabinet.checked ? undefined : cabinet.measured;
    // Neighbours measured on their carcass give the row's real depth.
    const rowDepths = row(cabinet)
      .filter((item) => item !== cabinet && item.role === cabinet.role && item.measured?.depth === "carcass")
      .map((item) => item.depthMm);
    const rowDepth = rowDepths.length ? median(rowDepths) : null;
    if (measured?.depth === "estimated")
      issues.push({
        level: "error",
        text: `${label}: гүнийг их биеэс хэмжиж чадсангүй, ${cabinet.depthMm} мм гэж таамагласан. Зураг дээрээс заавал шалгана уу.`,
        moduleIds: [cabinet.id],
        ...(rowDepth !== null && rowDepth !== cabinet.depthMm
          ? { fix: { label: `Эгнээний гүн ${rowDepth} мм болгох`, changes: [{ id: cabinet.id, change: { depthMm: rowDepth } }] } }
          : {}),
      });
    else if (
      !cabinet.checked &&
      rowDepth !== null &&
      rowDepths.length >= 2 &&
      Math.abs(cabinet.depthMm - rowDepth) > 30
    )
      issues.push({
        level: "warning",
        text: `${label}: гүн ${cabinet.depthMm} мм, эгнээний бусад шүүгээ ${rowDepth} мм. Дотор хайрцаг эсвэл угаалтуур хэмжигдсэн байж магадгүй.`,
        moduleIds: [cabinet.id],
        fix: { label: `Гүнийг ${rowDepth} мм болгох`, changes: [{ id: cabinet.id, change: { depthMm: rowDepth } }] },
      });
    const standard = Math.round(cabinet.widthMm / 50) * 50;
    const nearStandard =
      cabinet.widthMm !== standard && Math.abs(cabinet.widthMm - standard) <= 6;
    if (measured?.width === "front")
      issues.push({
        level: "warning",
        text: `${label}: өргөнийг хаалганы нүүрээр хэмжсэн (${cabinet.widthMm} мм). Их бие ихэвчлэн 2–4 мм илүү өргөн байдаг${nearStandard ? `; стандарт ${standard} мм байх магадлалтай` : ""}.`,
        moduleIds: [cabinet.id],
        ...(nearStandard
          ? { fix: { label: `${standard} мм болгох`, changes: [{ id: cabinet.id, change: { widthMm: standard, name: kitchenGlbModuleName(cabinet.role, standard) } }] } }
          : {}),
      });
    if (measured?.width === "merged")
      issues.push({
        level: "warning",
        text: `${label}: гараар нэгтгэсэн модуль. Хэмжээг дахин шалгана уу.`,
        moduleIds: [cabinet.id],
      });
    // Factories work in whole millimetres; odd sizes are usually a drawing slip.
    const off = cabinet.widthMm % 50;
    if (
      !cabinet.checked &&
      measured?.width !== "carcass" &&
      measured?.width !== "manual" &&
      measured?.width !== "front" &&
      off !== 0 &&
      Math.min(off, 50 - off) <= 6
    )
      issues.push({
        level: "warning",
        text: `${label}: өргөн ${cabinet.widthMm} мм нь стандарт ${Math.round(cabinet.widthMm / 50) * 50} мм-тэй ойрхон. Аль нь зөв болохыг шалгана уу.`,
        moduleIds: [cabinet.id],
        fix: {
          label: `${Math.round(cabinet.widthMm / 50) * 50} мм болгох`,
          changes: [{ id: cabinet.id, change: { widthMm: Math.round(cabinet.widthMm / 50) * 50, name: kitchenGlbModuleName(cabinet.role, Math.round(cabinet.widthMm / 50) * 50) } }],
        },
      });
    // A cabinet facing sideways inside another row: a side panel read as its
    // front. Its row turns it the row's way, width and depth swapping.
    const sameRow = row(cabinet).filter((item) => item !== cabinet);
    const touching = (a: KitchenGlbBox, b: KitchenGlbBox) =>
      [0, 1, 2].every(
        (axis) => Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]) >= -50,
      );
    const across = modules.filter(
      (item) =>
        item !== cabinet &&
        floor(item) === floor(cabinet) &&
        item.facing !== cabinet.facing &&
        touching(item.box, cabinet.box),
    );
    const turn = across[0]?.facing;
    if (
      !cabinet.checked &&
      turn &&
      !sameRow.some((item) => touching(item.box, cabinet.box)) &&
      across.every((item) => item.facing === turn)
    ) {
      const axis = depthAxis(turn);
      const band = across.map((item) => item.box);
      const inBand =
        Math.min(cabinet.box.max[axis], ...band.map((box) => box.max[axis])) -
        Math.max(cabinet.box.min[axis], ...band.map((box) => box.min[axis]));
      const extent = cabinet.box.max[axis] - cabinet.box.min[axis];
      if (inBand >= 0.8 * extent) {
        const along = axis === 0 ? 2 : 0;
        const widthMm = round(cabinet.box.max[along] - cabinet.box.min[along]);
        issues.push({
          level: "error",
          text: `${label}: хөрш шүүгээнүүдээсээ өөр тийш харж байна. Хажуугийн хавтанг нүүр гэж уншсан байж магадгүй.`,
          moduleIds: [cabinet.id],
          fix: {
            label: "Эгнээний чиглэлд эргүүлэх",
            changes: [{
              id: cabinet.id,
              change: {
                facing: turn,
                widthMm,
                depthMm: round(extent),
                name: kitchenGlbModuleName(cabinet.role, widthMm),
              },
            }],
          },
        });
      }
    }
  }
  // Two modules covering one body: the detection probably read a cabinet twice.
  for (let i = 0; i < modules.length; i++)
    for (let j = i + 1; j < modules.length; j++) {
      const ratio = overlapRatio(modules[i].box, modules[j].box);
      if (ratio > 0.15)
        issues.push({
          level: "error",
          text: `${modules[i].name} ба ${modules[j].name} ${Math.round(ratio * 100)}% давхцаж байна. Нэг шүүгээг хоёр удаа таньсан бол "Олныг сонгох"-оор нэгтгэнэ үү.`,
          moduleIds: [modules[i].id, modules[j].id],
        });
    }
  // Gaps inside a run: a filler panel or a size that does not add up.
  for (const role of ["base", "wall"] as const)
    for (const facing of ["+z", "-z", "+x", "-x"] as const) {
      const run = modules.filter(
        (item) => item.role === role && item.facing === facing,
      );
      const along = facing[1] === "x" ? 2 : 0;
      run.sort((a, b) => a.box.min[along] - b.box.min[along]);
      for (let index = 1; index < run.length; index++) {
        const gap = run[index].box.min[along] - run[index - 1].box.max[along];
        if (gap >= 3 && gap <= 120)
          issues.push({
            level: "warning",
            text: `${run[index - 1].name} ба ${run[index].name} хооронд ${round(gap)} мм зай байна. Нэмэлт хавтан (filler) эсвэл хэмжээний зөрүү эсэхийг шалгана уу.`,
            moduleIds: [run[index - 1].id, run[index].id],
          });
      }
      const heights = [...new Set(run.map((item) => item.heightMm))];
      if (
        role === "base" &&
        run.length > 1 &&
        Math.max(...heights) - Math.min(...heights) > 5 &&
        run.every((item) => item.measured?.height === "carcass")
      )
        issues.push({
          level: "warning",
          text: `Нэг эгнээний доод шүүгээнүүдийн өндөр зөрүүтэй (${heights.join(", ")} мм).`,
          moduleIds: run.map((item) => item.id),
        });
    }
  const curved = parts.filter(kitchenGlbCurved);
  if (curved.length)
    issues.push({
      level: "warning",
      text: `${curved.length} муруй/нугалсан хавтан илэрсэн. Хэмжээ нь тэгш өнцөгт хайрцгаар бус, дэлгэсэн урт ба радиусаар үйлдвэрлэгдэнэ — BOM-оос шалгана уу.`,
      moduleIds: [],
    });
  const loose = kitchenGlbLooseBoards(detection, parts);
  if (loose.length)
    issues.push({
      level: "warning",
      text: `${loose.length} хавтан аль ч модульд ороогүй (улаанаар харагдана). Шүүгээний хэсэг бол "Модуль нэмэх" эсвэл "Олныг сонгох"-оор холбоно уу.`,
      moduleIds: [],
    });
  return issues;
}

function overlapRatio(a: KitchenGlbBox, b: KitchenGlbBox) {
  const shared = [0, 1, 2].reduce(
    (product, axis) =>
      product *
      Math.max(
        0,
        Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]),
      ),
    1,
  );
  const volume = (box: KitchenGlbBox) =>
    size(box).reduce((product, side) => product * side, 1);
  return shared / Math.max(1, Math.min(volume(a), volume(b)));
}

export type KitchenGlbCategory =
  | "base"
  | "wall"
  | "tall"
  | "countertop"
  | "appliance"
  | "light"
  | "curved"
  | "panel"
  | "backsplash"
  | "other";

export const KITCHEN_GLB_CATEGORY_LABELS: Record<KitchenGlbCategory, string> = {
  base: "Доод шүүгээ",
  wall: "Дээд шүүгээ",
  tall: "Өндөр шүүгээ",
  countertop: "Тавцан",
  appliance: "Техник хэрэгсэл",
  light: "Гэрэл",
  curved: "Муруй хавтан",
  panel: "Хаалт, цокол хавтан",
  backsplash: "Ханын хавтан (фартук)",
  other: "Модульд ороогүй",
};

export const KITCHEN_GLB_CATEGORY_COLORS: Record<KitchenGlbCategory, string> = {
  base: "#3fae7a",
  wall: "#e8913f",
  tall: "#4f7fe0",
  countertop: "#b8bcc6",
  appliance: "#a35fdc",
  light: "#f2d34b",
  curved: "#38c3c9",
  panel: "#c8b08a",
  backsplash: "#8fb8a8",
  other: "#e0524f",
};

const LIGHT =
  /light|lamp|\bled\b|bulb|spot ?light|luminaire|гэрэл|чийдэн|лед|светил|ламп/i;

/** Boards (≤ 25 mm) that no cabinet, worktop or appliance covers. */
export function kitchenGlbLooseBoards(
  detection: KitchenGlbDetection,
  parts: readonly KitchenGlbPart[],
) {
  const categories = kitchenGlbPartCategories(detection, parts);
  // Specks (screws, cut-out edges) are not boards a merchant needs to place.
  return parts.filter(
    (part) =>
      categories.get(part.id) === "other" &&
      isBoard(part) &&
      Math.max(...size(part.box)) >= 30,
  );
}

/**
 * End panels, legs, plinths and the back cladding of a peninsula: thin
 * floor-standing parts against a cabinet. They finish a run; they are not a
 * cabinet of their own, so the merchant need not turn them into modules.
 */
function finishingPanel(part: KitchenGlbPart, against: readonly KitchenGlbBox[]) {
  const sides = size(part.box);
  if (Math.min(...sides) > 100 || sides[1] < 300) return false;
  return against.some(
    (box) =>
      [0, 1, 2].every(
        (axis) =>
          Math.min(part.box.max[axis], box.max[axis]) -
            Math.max(part.box.min[axis], box.min[axis]) >=
          -30,
      ) &&
      // Floor-standing, or the side panel of the cabinet it stands beside.
      (part.box.min[1] <= 200 ||
        (part.box.min[1] >= box.min[1] - 50 && part.box.max[1] <= box.max[1] + 50)),
  );
}

function splashBack(part: KitchenGlbPart) {
  const [w, h, d] = size(part.box);
  return (
    Math.min(w, d) <= BOARD &&
    Math.max(w, d) >= 200 &&
    h >= 150 &&
    part.box.min[1] >= 780 &&
    part.box.min[1] <= 1000
  );
}

/** Colour category of every part, for the viewport legend. */
export function kitchenGlbPartCategories(
  detection: KitchenGlbDetection,
  parts: readonly KitchenGlbPart[],
): Map<number, KitchenGlbCategory> {
  const result = new Map<number, KitchenGlbCategory>();
  for (const cabinet of detection.modules)
    for (const id of cabinet.parts) if (!result.has(id)) result.set(id, cabinet.role);
  for (const id of detection.countertopParts ?? [])
    if (!result.has(id)) result.set(id, "countertop");
  for (const item of detection.appliances ?? [])
    for (const id of item.parts) if (!result.has(id)) result.set(id, "appliance");
  // Parts inside a cabinet's box (shelves, rails, hinges) belong to it; small
  // hardware (knobs, handles) stands a little proud of the front.
  const inside = (part: KitchenGlbPart, box: KitchenGlbBox, margin = 3) =>
    [0, 1, 2].every(
      (axis) =>
        part.box.min[axis] >= box.min[axis] - margin &&
        part.box.max[axis] <= box.max[axis] + margin,
    );
  const hardware = (part: KitchenGlbPart) => Math.max(...size(part.box)) < 200;
  // A leg under a worktop overhang finishes the run as much as an end panel.
  const finished = [
    ...detection.modules.map((cabinet) => cabinet.box),
    ...parts
      .filter((part) => detection.countertopParts?.includes(part.id))
      .map((part) => part.box),
  ];
  for (const part of parts) {
    if (result.has(part.id)) continue;
    if (LIGHT.test([part.name, ...part.materials].join(" "))) {
      result.set(part.id, "light");
      continue;
    }
    if (kitchenGlbCurved(part)) {
      result.set(part.id, "curved");
      continue;
    }
    const holder = detection.modules.find((cabinet) =>
      inside(part, cabinet.box, hardware(part) ? 40 : 3),
    );
    if (holder) result.set(part.id, holder.role);
    else if (finishingPanel(part, finished)) result.set(part.id, "panel");
    // A wall sheet rising from the worktop: splash-back or wall cladding.
    else if (splashBack(part)) result.set(part.id, "backsplash");
    // Handles, feet, burners and grates around an appliance are part of it.
    else if (
      (detection.appliances ?? []).some((item) =>
        inside(part, {
          min: [item.box.min[0] - 120, item.box.min[1] - 20, item.box.min[2] - 120],
          // A tap rises well above its sink bowl.
          max: [item.box.max[0] + 120, item.box.max[1] + (item.kind === "sink" ? 500 : 80), item.box.max[2] + 120],
        }),
      )
    )
      result.set(part.id, "appliance");
    else result.set(part.id, "other");
  }
  return result;
}

/** One row of the bill of materials shown under the preview. */
export type KitchenGlbBomRow = {
  key: string;
  group: string;
  name: string;
  size: string;
  quantity: string;
  note?: string;
  moduleId?: string;
};

const SOURCE_NOTE: Record<string, string> = {
  carcass: "их биеэр хэмжсэн",
  front: "нүүрээр хэмжсэн",
  solid: "хайрцгаар хэмжсэн",
  estimated: "таамагласан",
  merged: "гараар нэгтгэсэн",
  manual: "гараар оруулсан",
};

/** Detailed bill of materials: every cabinet, worktop, curved panel and appliance. */
export function kitchenGlbBom(
  detection: KitchenGlbDetection,
  parts: readonly KitchenGlbPart[],
): KitchenGlbBomRow[] {
  const rows: KitchenGlbBomRow[] = detection.modules.map((cabinet, index) => ({
    key: cabinet.id,
    group: KITCHEN_GLB_ROLE_LABELS[cabinet.role],
    name: `${index + 1}. ${cabinet.name}`,
    size: `${cabinet.widthMm} × ${cabinet.heightMm} × ${cabinet.depthMm}`,
    quantity: "1 ш",
    note: cabinet.measured
      ? cabinet.measured.depth === cabinet.measured.width
        ? SOURCE_NOTE[cabinet.measured.width]
        : `өргөн ${SOURCE_NOTE[cabinet.measured.width]}, гүн ${SOURCE_NOTE[cabinet.measured.depth]}`
      : undefined,
    moduleId: cabinet.id,
  }));
  const byId = new Map(parts.map((part) => [part.id, part]));
  const tops = (detection.countertopParts ?? [])
    .map((id) => byId.get(id))
    .filter((part): part is KitchenGlbPart => !!part);
  tops.forEach((part, index) => {
    const [w, h, d] = size(part.box);
    rows.push({
      key: `top-${part.id}`,
      group: "Тавцан",
      name: `Тавцан ${index + 1}`,
      size: `${round(Math.max(w, d))} × ${round(Math.min(w, d))} × ${round(h)}`,
      quantity: `${((w * d) / 1e6).toFixed(2)} м²`,
    });
  });
  if (detection.backsplashM2)
    rows.push({
      key: "splash",
      group: "Тавцан",
      name: "Ханын хавтан",
      size: "—",
      quantity: `${detection.backsplashM2.toFixed(2)} м²`,
    });
  parts.filter(kitchenGlbCurved).forEach((part, index) => {
    const [w, h, d] = size(part.box);
    const thickness = part.thicknessMm ?? 0;
    // Developed length of a bent panel = one face's area / its height.
    const vertical = h >= Math.min(w, d);
    const height = vertical ? h : Math.min(w, d);
    const developed = part.areaMm2 ? part.areaMm2 / 2 / height : 0;
    rows.push({
      key: `curved-${part.id}`,
      group: "Муруй хавтан",
      name: `Муруй хавтан ${index + 1}${part.name ? ` (${part.name})` : ""}`,
      size: `${round(w)} × ${round(h)} × ${round(d)}`,
      quantity: "1 ш",
      note: `зузаан ≈ ${thickness} мм, дэлгэсэн урт ≈ ${round(developed)} мм`,
    });
  });
  const counts = new Map<string, number>();
  for (const item of detection.appliances ?? [])
    counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  for (const [kind, count] of counts)
    rows.push({
      key: `appliance-${kind}`,
      group: "Техник хэрэгсэл",
      name: KITCHEN_GLB_APPLIANCE_LABELS[kind as keyof typeof KITCHEN_GLB_APPLIANCE_LABELS],
      size: "—",
      quantity: `${count} ш`,
      note: "үнэд тусад нь",
    });
  return rows;
}

/**
 * "Доод шүүгээ 600 × 720 × 560 мм · 2 ш" lines: identical modules grouped,
 * offered as one-click suggestions in the listing's composition fields.
 */
export function kitchenGlbModuleLines(modules: readonly KitchenGlbModule[]) {
  const groups = new Map<string, number>();
  for (const cabinet of modules) {
    const key = `${KITCHEN_GLB_ROLE_LABELS[cabinet.role]} ${cabinet.widthMm} × ${cabinet.heightMm} × ${cabinet.depthMm} мм`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  return [...groups].map(([key, count]) => `${key} · ${count} ш`);
}

/**
 * Which GLB parts carry which finish, so a buyer can restyle the kitchen:
 * door and drawer faces, the carcass (and end panels unless they match the
 * faces), the worktop and handles/knobs. Appliances and walls keep theirs.
 */
export function kitchenGlbMaterialSlots(
  detection: KitchenGlbDetection,
  parts: readonly KitchenGlbPart[],
): KitchenGlbSlots {
  const slots: KitchenGlbSlots = { front: [], carcass: [], countertop: [], handle: [] };
  const categories = kitchenGlbPartCategories(detection, parts);
  const cabinetOf = (part: KitchenGlbPart) =>
    detection.modules.find((cabinet) => cabinet.parts.includes(part.id)) ??
    detection.modules.find((cabinet) =>
      [0, 1, 2].every(
        (axis) =>
          part.box.min[axis] >= cabinet.box.min[axis] - 40 &&
          part.box.max[axis] <= cabinet.box.max[axis] + 40,
      ),
    );
  // A face lies in the cabinet's front plane, thin along its depth.
  const face = (part: KitchenGlbPart, cabinet: KitchenGlbModule) => {
    const axis = depthAxisOf(cabinet);
    const sides = size(part.box);
    if (!isBoard(part) || sides.indexOf(Math.min(...sides)) !== axis) return false;
    if (part.box.min[1] <= 40 && sides[1] <= 200) return false; // a plinth
    return cabinet.facing[0] === "+"
      ? cabinet.box.max[axis] - part.box.max[axis] <= 40
      : part.box.min[axis] - cabinet.box.min[axis] <= 40;
  };
  const panels: KitchenGlbPart[] = [];
  for (const part of parts) {
    const category = categories.get(part.id);
    if (category === "countertop") slots.countertop.push(part.id);
    else if (category === "panel") panels.push(part);
    else if (category === "base" || category === "wall" || category === "tall") {
      const cabinet = cabinetOf(part);
      if (Math.max(...size(part.box)) < 200) slots.handle.push(part.id);
      else if (cabinet && face(part, cabinet)) slots.front.push(part.id);
      else slots.carcass.push(part.id);
    }
  }
  // End panels and claddings usually match the faces when they share a material.
  const faceMaterials = new Set(
    slots.front.flatMap((id) => parts.find((part) => part.id === id)?.materials ?? []),
  );
  for (const part of panels)
    (part.materials.some((name) => faceMaterials.has(name)) ? slots.front : slots.carcass).push(part.id);
  return slots;
}
