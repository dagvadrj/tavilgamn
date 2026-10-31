import type { KitchenGlbSlot } from "./kitchenMarketplace";

/** One finish a buyer can pick for a slot of a ready-made GLB kitchen. */
export type KitchenFinishOption = {
  id: string;
  label: string;
  color: string;
  roughness: number;
  metalness: number;
};

export const KITCHEN_SLOT_LABELS: Record<KitchenGlbSlot, string> = {
  front: "Нүүр (хаалга, шургуулга)",
  carcass: "Их бие",
  countertop: "Тавцан",
  handle: "Бариул",
};

const matte = (id: string, label: string, color: string): KitchenFinishOption => ({
  id, label, color, roughness: 0.8, metalness: 0,
});
const wood = (id: string, label: string, color: string): KitchenFinishOption => ({
  id, label, color, roughness: 0.65, metalness: 0,
});

/** Curated finishes per slot; "original" (the merchant's own) is always first. */
export const KITCHEN_FINISHES: Record<KitchenGlbSlot, KitchenFinishOption[]> = {
  front: [
    matte("white", "Цагаан мат", "#f2f1ec"),
    matte("light-grey", "Цайвар саарал", "#c9c7c1"),
    matte("beige", "Шаргал", "#d8c9ae"),
    matte("olive", "Чидун ногоон", "#6b7058"),
    matte("blue-grey", "Хөх саарал", "#5c6b78"),
    matte("anthracite", "Антрацит", "#3b3d40"),
    matte("black", "Хар мат", "#1d1d1f"),
    wood("oak", "Царс", "#b48a5a"),
    wood("walnut", "Хушга", "#6e4a32"),
  ],
  carcass: [
    matte("white", "Цагаан", "#f4f3ef"),
    matte("grey", "Саарал", "#b9b8b3"),
    matte("anthracite", "Антрацит", "#3b3d40"),
    wood("oak", "Царс", "#b48a5a"),
  ],
  countertop: [
    { id: "white-quartz", label: "Цагаан кварц", color: "#eeece6", roughness: 0.35, metalness: 0 },
    { id: "black-marble", label: "Хар гантиг", color: "#222224", roughness: 0.3, metalness: 0 },
    { id: "concrete", label: "Саарал бетон", color: "#9a9893", roughness: 0.85, metalness: 0 },
    wood("oak", "Царс", "#a77b4f"),
  ],
  handle: [
    { id: "chrome", label: "Хром", color: "#d9dadc", roughness: 0.25, metalness: 1 },
    { id: "black", label: "Хар мат", color: "#1c1c1c", roughness: 0.6, metalness: 0.4 },
    { id: "brass", label: "Алтан", color: "#c9a45c", roughness: 0.35, metalness: 1 },
  ],
};

export type KitchenFinishChoice = Partial<Record<KitchenGlbSlot, string>>;

/** "Нүүр: Антрацит · Тавцан: Цагаан кварц" for the quote request. */
export function kitchenFinishSummary(choice: KitchenFinishChoice) {
  return (Object.keys(KITCHEN_SLOT_LABELS) as KitchenGlbSlot[])
    .flatMap((slot) => {
      const option = KITCHEN_FINISHES[slot].find((item) => item.id === choice[slot]);
      return option ? [`${KITCHEN_SLOT_LABELS[slot].split(" (")[0]}: ${option.label}`] : [];
    })
    .join(" · ");
}
