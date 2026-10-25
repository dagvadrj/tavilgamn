import type { CabinetPose, ModularKitchen } from "./kitchenCabinets";

export type KitchenCornerPlan = { side: "left" | "right"; clearanceMm: number; mainCount: number };
export function kitchenCornerGeometry(kitchen: ModularKitchen) {
  const plan = kitchen.cornerPlan;
  if (!plan || kitchen.layout !== `l-${plan.side}`) return undefined;
  const main = kitchen.cabinets.filter(c => c.type === "base" && Math.abs(c.position.rotation) < .001)
    .sort((a, b) => plan.side === "left" ? a.position.x - b.position.x : b.position.x - a.position.x)[0];
  const returning = kitchen.cabinets.filter(c => c.type === "base" && Math.abs(c.position.rotation - (plan.side === "left" ? Math.PI / 2 : -Math.PI / 2)) < .001)
    .sort((a, b) => a.position.z - b.position.z)[0];
  if (!main || !returning || Math.abs(main.height - returning.height) > .001) return undefined;
  const w = returning.depth + plan.clearanceMm, d = main.depth + plan.clearanceMm;
  const edge = plan.side === "left" ? main.position.x - main.width / 2 : kitchen.room.width - main.position.x - main.width / 2;
  if (Math.abs(edge - w) > .001 || Math.abs(returning.position.z - returning.width / 2 - d) > .001) return undefined;
  const x = (fromSide: number) => plan.side === "left" ? fromSide : kitchen.room.width - fromSide;
  const position: CabinetPose = { x: x(w / 2), z: d / 2, y: main.height, rotation: 0 };
  return { width: w, depth: d, position, main, returning, panels: [
    { id: "corner-filler-main", width: plan.clearanceMm, height: main.height - 80, thickness: 18,
      position: { x: x(returning.depth + plan.clearanceMm / 2), z: main.depth - 9, y: 80, rotation: 0 }, cabinet: main },
    { id: "corner-filler-return", width: plan.clearanceMm, height: returning.height - 80, thickness: 18,
      position: { x: x(returning.depth - 9), z: main.depth + plan.clearanceMm / 2, y: 80, rotation: plan.side === "left" ? Math.PI / 2 : -Math.PI / 2 }, cabinet: returning },
  ] };
}

export function parseKitchenCornerPlan(value: unknown, cabinetCount?: number): KitchenCornerPlan | undefined {
  if (value === undefined) return undefined;
  const raw = value as KitchenCornerPlan;
  if (!raw || !["left", "right"].includes(raw.side) || !Number.isInteger(raw.clearanceMm) || raw.clearanceMm < 40 || raw.clearanceMm > 150 ||
    !Number.isInteger(raw.mainCount) || raw.mainCount < 1 || raw.mainCount > 79 || (cabinetCount !== undefined && raw.mainCount >= cabinetCount))
    throw new Error("Булангийн зай, байрлуулах шүүгээний тоо буруу байна.");
  return { side: raw.side, clearanceMm: raw.clearanceMm, mainCount: raw.mainCount };
}
