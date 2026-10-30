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
  wall: { width: [150, 1200], height: [250, 1300], depth: [150, 500] },
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
};

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
    if (measured?.depth === "estimated")
      issues.push({
        level: "error",
        text: `${label}: гүнийг их биеэс хэмжиж чадсангүй, ${cabinet.depthMm} мм гэж таамагласан. Зураг дээрээс заавал шалгана уу.`,
        moduleIds: [cabinet.id],
      });
    if (measured?.width === "front")
      issues.push({
        level: "warning",
        text: `${label}: өргөнийг хаалганы нүүрээр хэмжсэн (${cabinet.widthMm} мм). Их бие ихэвчлэн 2–4 мм илүү өргөн байдаг.`,
        moduleIds: [cabinet.id],
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
      off !== 0 &&
      Math.min(off, 50 - off) <= 6
    )
      issues.push({
        level: "warning",
        text: `${label}: өргөн ${cabinet.widthMm} мм нь стандарт ${Math.round(cabinet.widthMm / 50) * 50} мм-тэй ойрхон. Аль нь зөв болохыг шалгана уу.`,
        moduleIds: [cabinet.id],
      });
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
  | "other";

export const KITCHEN_GLB_CATEGORY_LABELS: Record<KitchenGlbCategory, string> = {
  base: "Доод шүүгээ",
  wall: "Дээд шүүгээ",
  tall: "Өндөр шүүгээ",
  countertop: "Тавцан",
  appliance: "Техник хэрэгсэл",
  light: "Гэрэл",
  curved: "Муруй хавтан",
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
  return parts.filter(
    (part) => categories.get(part.id) === "other" && isBoard(part),
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
  // Parts inside a cabinet's box (shelves, rails, hinges) belong to it.
  const inside = (part: KitchenGlbPart, box: KitchenGlbBox) =>
    [0, 1, 2].every(
      (axis) =>
        part.box.min[axis] >= box.min[axis] - 3 &&
        part.box.max[axis] <= box.max[axis] + 3,
    );
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
      inside(part, cabinet.box),
    );
    result.set(part.id, holder ? holder.role : "other");
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
