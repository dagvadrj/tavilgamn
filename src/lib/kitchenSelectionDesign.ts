import { arrangeKitchen, cloneKitchen, parseKitchen } from "./kitchenAssembly";
import { CABINET_DEFAULTS, DEFAULT_COUNTERTOP_THICKNESS, DEFAULT_WALL_CLEARANCE, type ModularKitchen } from "./kitchenCabinets";
import { kitchenVariantFromModule, type KitchenCatalogModule } from "./kitchenModuleCatalog";
import { alignToServices, createSuggestedKitchen, fillUKitchen, type KitchenSuggestionPreferences } from "./kitchenSuggestions";
import { furnishKitchenFromCatalog } from "./kitchenCatalogFurnishing";
import { placementIssues } from "./kitchenPlacement";
import { findExtraSpace } from "./kitchenExtras";

/** Called only by the explicit final choice action. Browsing steps never replaces
 * a furnished project. Failure leaves the previous design available for undo. */
export function createKitchenFromSelection(previous: ModularKitchen, preferences: KitchenSuggestionPreferences, modules: KitchenCatalogModule[]) {
  // A U is filled after the catalog swap, with widths the catalog really has;
  // swapping first would resize and re-pack the fillers into new gaps.
  let proposed = createSuggestedKitchen(preferences, {
    width: previous.room.width / 1000, depth: previous.room.depth / 1000, height: previous.room.height / 1000,
  }, { fill: false, room: cloneKitchen(previous).room });
  proposed.room = cloneKitchen(previous).room;
  proposed.countertop = { ...previous.countertop };
  proposed.backsplash = previous.backsplash;
  proposed.backsplashMaterialId = previous.backsplashMaterialId;
  for (const c of proposed.cabinets) {
    const old = previous.cabinets.find(item => item.id === c.id && item.type === c.type);
    if (old) {
      c.frontMaterialId = old.frontMaterialId; c.carcassMaterialId = old.carcassMaterialId;
    }
  }
  let error = 'Сонгосон төхөөрөмж, байрлал энэ өрөөнд багтахгүй байна.';
  const attempts = proposed.cabinets.length + 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const catalog = modules.some(m => m.variants.some(v => v.active && v.glbFile));
    const result = catalog ? furnishKitchenFromCatalog(proposed, modules) : { design: proposed };
    if (result.design) {
      let checked = result.design;
      if (preferences.layout === "u" && !placementIssues(checked).some(i => i.severity === "error"))
        checked = fillWithCatalog(checked, catalog ? modules : null);
      const issue = placementIssues(checked).find(i => i.severity === 'error');
      if (!issue) {
        for (const extra of cloneKitchen(previous).extras ?? []) {
          if (extra.asset?.type === "hood" && extra.mount) continue; // The new hood answer replaces old mounted equipment.
          const placed = findExtraSpace(checked, extra);
          if (!placed) throw new Error(`${extra.name} байрлуулах зай алга. Өмнөх загвар хадгалагдсан.`);
          checked.extras = [...(checked.extras ?? []), placed];
        }
        return parseKitchen(checked);
      }
      error = issue.message;
    } else error = result.error ?? error;
    // Appliance choices take priority over optional storage in a small room.
    const storage = proposed.cabinets.filter(c => ['doors', 'drawers', 'open', undefined].includes(c.opening));
    const remove = storage.find(c => c.type === 'wall') ?? storage.at(-1);
    if (!remove) break;
    proposed = alignToServices(arrangeKitchen({ ...proposed, cabinets: proposed.cabinets.filter(c => c.id !== remove.id) }, preferences.layout), preferences.layout);
  }
  throw new Error(`${error} Өрөөний хэмжээ эсвэл байрлалын сонголтоо өөрчилнө үү.`);
}

/** Close the U's empty corners and short sides; keep the unfilled design if the catalog can't. */
function fillWithCatalog(kitchen: ModularKitchen, modules: KitchenCatalogModule[] | null) {
  if (!modules) return fillUKitchen(kitchen);
  // An upper must fit between its standard mounting height and the ceiling.
  const upperRoom = kitchen.room.height - (CABINET_DEFAULTS.base.height + DEFAULT_COUNTERTOP_THICKNESS + DEFAULT_WALL_CLEARANCE);
  const widths = (type: "base" | "wall") => [...new Set(modules.filter(m => m.active && m.cabinetType === type &&
    (type === "base" || m.heightMm <= upperRoom) &&
    m.variants.some(raw => {
      const v = kitchenVariantFromModule(m, raw);
      return v.active && v.glbFile && v.processingStatus === "ready" && !v.assetValidationIssues?.length && ["doors", "drawers"].includes(v.opening);
    })).map(m => m.widthMm))].filter(w => type === "wall" || w <= 600);
  const filled = furnishKitchenFromCatalog(fillUKitchen(kitchen, { base: widths("base"), wall: widths("wall") }), modules);
  return filled.design && !placementIssues(filled.design).some(i => i.severity === "error") ? filled.design : kitchen;
}
