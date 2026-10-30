import { arrangeKitchen, cloneKitchen, parseKitchen } from "./kitchenAssembly";
import type { ModularKitchen } from "./kitchenCabinets";
import type { KitchenCatalogModule } from "./kitchenModuleCatalog";
import { createSuggestedKitchen, type KitchenSuggestionPreferences } from "./kitchenSuggestions";
import { furnishKitchenFromCatalog } from "./kitchenCatalogFurnishing";
import { placementIssues } from "./kitchenPlacement";
import { findExtraSpace } from "./kitchenExtras";

/** Called only by the explicit final choice action. Browsing steps never replaces
 * a furnished project. Failure leaves the previous design available for undo. */
export function createKitchenFromSelection(previous: ModularKitchen, preferences: KitchenSuggestionPreferences, modules: KitchenCatalogModule[]) {
  let proposed = createSuggestedKitchen(preferences, {
    width: previous.room.width / 1000, depth: previous.room.depth / 1000, height: previous.room.height / 1000,
  });
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
    const result = modules.some(m => m.variants.some(v => v.active && v.glbFile))
      ? furnishKitchenFromCatalog(proposed, modules) : { design: proposed };
    if (result.design) {
      const checked = result.design;
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
    proposed = arrangeKitchen({ ...proposed, cabinets: proposed.cabinets.filter(c => c.id !== remove.id) }, preferences.layout);
  }
  throw new Error(`${error} Өрөөний хэмжээ эсвэл байрлалын сонголтоо өөрчилнө үү.`);
}
