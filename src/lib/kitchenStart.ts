import { cloneKitchen, arrangeKitchen } from "./kitchenAssembly";
import {
  createSuggestedKitchen,
  DEFAULT_KITCHEN_SUGGESTION,
  type SuggestionLayout,
} from "./kitchenSuggestions";
import { placementIssues } from "./kitchenPlacement";
import { findExtraSpace } from "./kitchenExtras";
import { parseKitchenSpace, spaceItemCandidates } from "./kitchenSpace";
import type { ModularKitchen } from "./kitchenCabinets";

export interface KitchenStartOptions {
  width: number;
  depth: number;
  height: number;
  layout: SuggestionLayout;
  furnished: boolean;
  useSelected: boolean;
  useCatalog: boolean;
  door: boolean;
  window: boolean;
}

/** All authoring dimensions stay in mm. Reject an impossible plan instead of changing the user's room. */
export function startKitchen(
  previous: ModularKitchen,
  options: KitchenStartOptions,
): ModularKitchen {
  for (const value of [options.width, options.depth])
    if (!Number.isInteger(value) || value < 2000 || value > 8000)
      throw new Error("Өрөөний өргөн, гүн 2000–8000 мм байна.");
  if (
    !Number.isInteger(options.height) ||
    options.height < 2200 ||
    options.height > 3500
  )
    throw new Error("Таазны өндөр 2200–3500 мм байна.");
  if (options.furnished && !options.useSelected && !options.useCatalog)
    throw new Error("Тавилгын эх үүсвэрээ сонгоно уу.");
  let next = cloneKitchen(previous);
  next.room = {
    width: options.width,
    depth: options.depth,
    height: options.height,
    items: [],
  };
  next.extras = [];
  next.cabinets = [];
  next.backsplash = undefined;
  if (options.furnished) {
    if (options.useCatalog)
      next = createSuggestedKitchen(
        { ...DEFAULT_KITCHEN_SUGGESTION, layout: options.layout },
        {
          width: options.width / 1000,
          depth: options.depth / 1000,
          height: options.height / 1000,
        },
      );
    next.room.items = [];
    if (options.useSelected) {
      const selected = cloneKitchen(previous).cabinets;
      // Chosen pieces take priority over the corresponding recommended type.
      if (options.useCatalog)
        next.cabinets = next.cabinets.filter(
          (c) =>
            !selected.some((s) => s.type === c.type && s.opening === c.opening),
        );
      next.cabinets = [...selected, ...next.cabinets];
      next = arrangeKitchen(next, options.layout);
      for (const extra of cloneKitchen(previous).extras ?? []) {
        const placed = findExtraSpace(next, extra);
        if (!placed)
          throw new Error(
            `${extra.name} багтах зай алга. Өрөөний хэмжээг нэмнэ үү.`,
          );
        next.extras = [...(next.extras ?? []), placed];
      }
    }
  }
  next.layout = options.layout;
  const error = placementIssues(next).find(
    (issue) => issue.severity === "error",
  );
  if (error) throw new Error(error.message);
  for (const kind of ["door", "window"] as const) {
    if (!(kind === "door" ? options.door : options.window)) continue;
    let placed = false;
    for (const wall of kind === "door"
      ? (["front", "left", "right", "back"] as const)
      : (["back", "right", "left", "front"] as const)) {
      for (const item of spaceItemCandidates(
        next.room,
        kind,
        wall,
        `start-${kind}`,
      )) {
        const room = {
          ...next.room,
          items: [...(next.room.items ?? []), item],
        };
        try {
          parseKitchenSpace(room);
          if (
            placementIssues({ ...next, room }).some(
              (i) => i.severity === "error",
            )
          )
            continue;
          next.room = room;
          placed = true;
          break;
        } catch {
          /* Try the next position. */
        }
      }
      if (placed) break;
    }
    if (!placed)
      throw new Error(
        `${kind === "door" ? "Хаалга" : "Цонх"} байрлуулах зай алга.`,
      );
  }
  return next;
}
