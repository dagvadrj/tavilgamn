import {
  createCabinet,
  createHood,
  createRefrigerator,
  type KitchenLayout,
  type ModularKitchen,
} from "./kitchenCabinets";
import { arrangeKitchen, createUnifiedKitchen } from "./kitchenAssembly";
import { withOpening } from "./kitchenComponents";

export type OvenPreference = "under-worktop" | "high-cabinet";
export type HoodPreference = "integrated" | "wall" | "none";
export type RefrigeratorPreference = "integrated" | "freestanding" | "none";
export type SuggestionLayout = "straight" | "l-right" | "double-side";

export interface KitchenSuggestionPreferences {
  oven: OvenPreference;
  hood: HoodPreference;
  refrigerator: RefrigeratorPreference;
  layout: SuggestionLayout;
}

export const DEFAULT_KITCHEN_SUGGESTION: KitchenSuggestionPreferences = {
  oven: "under-worktop",
  hood: "integrated",
  refrigerator: "integrated",
  layout: "l-right",
};

/** Build a real editable design from the short suggestion questionnaire. */
export function createSuggestedKitchen(
  preferences: KitchenSuggestionPreferences,
): ModularKitchen {
  const kitchen = createUnifiedKitchen();
  const baseOven = kitchen.cabinets.find(
    (cabinet) => cabinet.type === "base" && cabinet.opening === "oven",
  );

  if (preferences.oven === "high-cabinet" && baseOven) {
    // Keep the cooktop in the base run while moving only the oven cavity up.
    Object.assign(baseOven, withOpening(baseOven, "hob"));
    const tallOven = withOpening(
      createCabinet("tall", "suggested-tall-oven", 600, kitchen.room.height),
      "oven",
    );
    tallOven.finish = baseOven.finish;
    tallOven.frontStyle = baseOven.frontStyle;
    tallOven.color = baseOven.color;
    kitchen.cabinets.push(tallOven);
  }

  const cooker = kitchen.cabinets.find(
    (cabinet) => cabinet.opening === "oven" || cabinet.opening === "hob",
  );
  if (preferences.hood !== "none" && cooker) {
    const hood = createHood(
      "suggested-hood",
      preferences.hood === "integrated" ? "under-cabinet" : "wall",
      600,
    );
    hood.position.x = cooker.position.x;
    hood.position.z = cooker.position.z;
    if (preferences.hood === "integrated") {
      hood.finish = "oak";
      hood.color = "#e5d6bd";
      hood.material = "wood";
    }
    kitchen.cabinets.push(hood);
  }

  if (preferences.refrigerator !== "none") {
    const refrigerator = createRefrigerator(
      "suggested-refrigerator",
      preferences.refrigerator === "integrated" ? "top-bottom" : "side-by-side",
    );
    if (preferences.refrigerator === "integrated") {
      refrigerator.finish = "oak";
      refrigerator.frontStyle = "flat";
      refrigerator.color = "#e5d6bd";
      refrigerator.material = "wood";
    }
    kitchen.cabinets.push(refrigerator);
  }

  return arrangeKitchen(kitchen, preferences.layout as KitchenLayout);
}
