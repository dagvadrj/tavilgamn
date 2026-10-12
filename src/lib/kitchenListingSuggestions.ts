import type { KitchenDesignSummary } from "./kitchenMarketplace";
import { parseKitchen } from "./kitchenAssembly";
import { buildKitchenBom } from "./kitchenBom";
import { FINISHES } from "./kitchen";

export const KITCHEN_STYLE_LABELS: Record<string, string> = {
  modern: "Модерн",
  classic: "Классик",
  minimal: "Минимал",
  industrial: "Индастриал",
  scandinavian: "Скандинав",
};
export const KITCHEN_LAYOUT_LABELS: Record<string, string> = {
  straight: "Шулуун",
  "l-left": "L хэлбэр",
  "l-right": "L хэлбэр",
  u: "U хэлбэр",
  "double-side": "Хоёр талт",
};
export const KITCHEN_TAG_SUGGESTIONS = [
  "модерн",
  "минимал",
  "модон фасад",
  "царс",
  "цагаан",
  "L хэлбэр",
  "жижиг гал тогоо",
  "захиалгаар",
];
export const KITCHEN_SERVICE_AREAS = [
  "Улаанбаатар",
  "Дархан",
  "Эрдэнэт",
  "Орон нутаг",
];
export const KITCHEN_MATERIAL_SUGGESTIONS = [
  "MDF",
  "Ламинат хавтан",
  "Царс",
  "Гантиг",
  "Кварц чулуун тавцан",
  "Матт фасад",
];
export type KitchenListingSuggestions = {
  titles: string[];
  shortDescriptions: string[];
  descriptions: string[];
  materials: string[];
  tags: string[];
  inclusions: string[];
  exclusions: string[];
  layout: string;
  cabinetCount: number;
  widthMm: number;
  depthMm: number;
};

export function kitchenListTokens(value: string) {
  const seen = new Set<string>();
  return value
    .split(/[\n,]/)
    .map((item) => item.normalize("NFKC").trim().replace(/^#+/, "").trim())
    .filter((item) => {
      const key = item.toLocaleLowerCase("mn");
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function kitchenListingSuggestions(
  snapshot: unknown,
  name = "",
  style = "modern",
): KitchenListingSuggestions | null {
  try {
    const kitchen = parseKitchen(snapshot);
    const bom = buildKitchenBom(kitchen, [], []);
    const excludedIds = new Set((kitchen.extras ?? []).map((item) => item.id));
    for (const cabinet of kitchen.cabinets) {
      if (
        cabinet.opening === "refrigerator" ||
        (cabinet.opening === "hood" && cabinet.hoodMount === "wall")
      )
        excludedIds.add(cabinet.id);
    }
    const appliances = new Set([
      "sink",
      "tap",
      "oven",
      "cooktop",
      "hood",
      "refrigerator",
    ]);
    const groups = {
      included: new Map<
        string,
        { label: string; quantity: number; unit: string }
      >(),
      excluded: new Map<
        string,
        { label: string; quantity: number; unit: string }
      >(),
    };
    for (const item of bom.items) {
      if (
        item.id.includes("/") &&
        excludedIds.has(item.id.slice(0, item.id.lastIndexOf("/")))
      )
        continue;
      const part = item.id.slice(item.id.lastIndexOf("/") + 1);
      const excluded =
        excludedIds.has(item.id) ||
        (item.id.includes("/") && appliances.has(part));
      const label = item.label
        .split(" · ")[0]
        .replace(/^(Тавцан|Ханын хавтан) \d+$/, "$1");
      const group = excluded ? groups.excluded : groups.included;
      const key = `${label}:${item.unit}`;
      const previous = group.get(key);
      group.set(key, {
        label,
        quantity: (previous?.quantity ?? 0) + item.quantity,
        unit: item.unit,
      });
    }
    const labels = (
      group: Map<string, { label: string; quantity: number; unit: string }>,
    ) =>
      [...group.values()].map(
        (item) =>
          `${item.label} · ${Number(item.quantity.toFixed(2))} ${item.unit}`,
      );
    const finishLabel = (id: string) =>
      FINISHES.find((item) => item.id === id)?.name ??
      (
        {
          wood: "Модон фасад",
          laminate: "Ламинат тавцан",
          granite: "Чулуун тавцан",
        } as Record<string, string>
      )[id];
    const materials = [
      ...new Set(
        [
          ...kitchen.cabinets.map((c) => finishLabel(c.finish ?? c.material)),
          finishLabel(kitchen.countertop.finish ?? kitchen.countertop.material),
        ].filter((value): value is string => !!value),
      ),
    ];
    const layout = kitchen.layout ?? "straight";
    const layoutLabel = KITCHEN_LAYOUT_LABELS[layout] ?? layout;
    const styleLabel = KITCHEN_STYLE_LABELS[style] ?? style;
    const count = kitchen.cabinets.filter((c) => !excludedIds.has(c.id)).length;
    const short = `${styleLabel} хэв маягийн ${layoutLabel.toLocaleLowerCase("mn")} гал тогоо. ${count} модультай, өрөөний хэмжээнд тохируулан захиалах боломжтой.`;
    return {
      titles: [
        ...new Set(
          [
            name.trim(),
            `${styleLabel} ${layoutLabel.toLocaleLowerCase("mn")} гал тогоо`,
          ].filter(Boolean),
        ),
      ],
      shortDescriptions: [short],
      descriptions: [
        `${short}\n\nТөлөвлөсөн өрөө: ${kitchen.room.width} × ${kitchen.room.depth} мм. Өнгө, материал болон захиалгын нөхцөлийг үйлдвэрлэгчтэй тохиролцоно.`,
      ],
      materials,
      tags: [
        ...new Set([
          styleLabel.toLocaleLowerCase("mn"),
          layoutLabel,
          ...materials.map((item) => item.toLocaleLowerCase("mn")),
          "захиалгаар",
        ]),
      ],
      inclusions: labels(groups.included),
      exclusions: labels(groups.excluded),
      layout,
      cabinetCount: count,
      widthMm: kitchen.room.width,
      depthMm: kitchen.room.depth,
    };
  } catch {
    return null;
  }
}

export function kitchenDesignMatchesSearch(
  design: Pick<
    KitchenDesignSummary,
    | "title"
    | "shortDescription"
    | "description"
    | "tags"
    | "materials"
    | "storeName"
    | "style"
    | "layout"
  >,
  query: string,
) {
  const normalize = (value: string) =>
    value.normalize("NFKC").toLocaleLowerCase("mn").replace(/#/g, "").trim();
  const text = normalize(
    [
      design.title,
      design.shortDescription,
      design.description,
      design.storeName,
      KITCHEN_STYLE_LABELS[design.style] ?? design.style,
      KITCHEN_LAYOUT_LABELS[design.layout] ?? design.layout,
      ...design.tags,
      ...design.materials,
    ].join(" "),
  );
  return normalize(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => text.includes(term));
}
