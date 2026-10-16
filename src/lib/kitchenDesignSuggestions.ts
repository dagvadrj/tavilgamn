import type { ModularKitchen } from "./kitchenCabinets";
import { arrangeKitchen } from "./kitchenAssembly";
import { placementIssues } from "./kitchenPlacement";

const OPTIONS = [
  { title: "Шулуун байрлал", layout: "straight", color: "#ece8df" },
  { title: "Баруун L байрлал", layout: "l-right", color: "#b99165" },
  { title: "Зүүн L байрлал", layout: "l-left", color: "#a7b5a0" },
  { title: "U байрлал", layout: "u", color: "#515b60" },
  { title: "Хоёр талт байрлал", layout: "double-side", color: "#d5c9b8" },
] as const;

export function kitchenDesignSuggestions(kitchen: ModularKitchen) {
  return OPTIONS.map(option => {
    const arranged = arrangeKitchen(structuredClone(kitchen), option.layout);
    const fits = !placementIssues(arranged).some(issue => issue.severity === "error");
    // If a different layout cannot fit, offer a finish variation of the user's
    // actual layout. Never discard cabinets or enlarge the room to force a fit.
    const design = fits ? arranged : structuredClone(kitchen);
    if (!fits) design.cabinets = design.cabinets.map(cabinet =>
      ["base", "wall", "tall"].includes(cabinet.type)
        ? { ...cabinet, color: option.color, finish: undefined, frontMaterialId: undefined, carcassMaterialId: undefined }
        : cabinet);
    const issue = placementIssues(design).find(issue => issue.severity === "error");
    return { ...option, design, fits, issue };
  });
}
