import "server-only";
import { parseKitchen } from "./kitchenAssembly";
import { KitchenMarketplaceInputError } from "./kitchenMarketplace";

/**
 * Planner copy of a GLB design, built in the browser from the modules the
 * merchant confirmed. It is re-validated with the planner's own rules so
 * "open in planner" never receives a kitchen the planner would reject.
 */
export function readKitchenGlbPlanner(value: unknown) {
  if (value === undefined || value === null) return null;
  try {
    const kitchen = parseKitchen(value);
    if (!kitchen.cabinets.length || kitchen.cabinets.length > 80)
      throw new Error();
    const json = JSON.parse(JSON.stringify(kitchen)) as Record<string, unknown>;
    if (JSON.stringify(json).length > 200_000) throw new Error();
    return json;
  } catch (error) {
    throw new KitchenMarketplaceInputError(
      error instanceof Error && error.message
        ? `Төлөвлөгчийн хувилбар буруу байна: ${error.message}`
        : "Төлөвлөгчийн хувилбар буруу байна. Модулиудаа шалгана уу.",
    );
  }
}
