import { cabinetWidths, createCabinet, createHood, createRefrigerator, type CabinetWidth } from "./kitchenCabinets";
import { withOpening } from "./kitchenComponents";

// These built-in choices are available even when the remote model library is empty.
export const KITCHEN_STANDARD_CHOICES = [
  { id: "base", label: "Доод шүүгээ", symbol: "base" },
  { id: "wall", label: "Дээд шүүгээ", symbol: "wall" },
  { id: "tall", label: "Өндөр шүүгээ", symbol: "tall" },
  { id: "hob", label: "Плиткатай шүүгээ", symbol: "base" },
  { id: "sink", label: "Угаалтууртай шүүгээ", symbol: "base" },
  { id: "oven-base", label: "Зуух · тавцангийн доор", symbol: "base" },
  { id: "oven-tall", label: "Зуух · өндөр шүүгээнд", symbol: "tall" },
  { id: "hood-integrated", label: "Сорогч · шүүгээний доор", symbol: "wall" },
  { id: "hood-wall", label: "Сорогч · хананд", symbol: "wall" },
  { id: "fridge-top", label: "Хөргөгч · дээр, доор хаалга", symbol: "tall" },
  { id: "fridge-side", label: "Хөргөгч · зэрэгцээ хаалга", symbol: "tall" },
] as const;
export type KitchenStandardType = typeof KITCHEN_STANDARD_CHOICES[number]["id"];

export function standardCabinetWidths(type: KitchenStandardType): readonly CabinetWidth[] {
  if (type.startsWith("fridge") || type.startsWith("oven")) return [];
  if (type === "hob" || type === "sink") return cabinetWidths("base").filter(width => width >= 600);
  if (type.startsWith("hood")) return cabinetWidths("wall").filter(width => width >= 600);
  return cabinetWidths(type as "base" | "wall" | "tall");
}

export function createStandardKitchenCabinet(type: KitchenStandardType, id: string, width: CabinetWidth, ceiling: number) {
  if (type.startsWith("fridge")) return createRefrigerator(id, type === "fridge-side" ? "side-by-side" : "top-bottom");
  if (type.startsWith("hood")) return createHood(id, type === "hood-integrated" ? "under-cabinet" : "wall", width);
  if (type.startsWith("oven")) return withOpening(createCabinet(type === "oven-tall" ? "tall" : "base", id, 600, ceiling), "oven");
  if (type === "hob" || type === "sink") return withOpening(createCabinet("base", id, width, ceiling), type);
  return createCabinet(type as "base" | "wall" | "tall", id, width, ceiling);
}
