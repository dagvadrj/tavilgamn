import type { ModularKitchen } from "./kitchenCabinets";
import { placementIssues, resolveElevations } from "./kitchenPlacement";
import {
  parseKitchenCornerPlan,
  type KitchenCornerPlan,
} from "./kitchenCornerGeometry";

/** Pick a valid split before changing the design, preferring balanced wall use. */
export function recommendKitchenCorner(
  kitchen: ModularKitchen,
  side: KitchenCornerPlan["side"],
  clearanceMm = 60,
): ModularKitchen {
  const base = kitchen.cabinets.filter((c) => c.type === "base");
  if (base.length < 2)
    throw new Error(
      "Булан үүсгэхийн тулд доод талын 2-оос доошгүй шүүгээ нэмээрэй.",
    );
  const splits = Array.from({ length: base.length - 1 }, (_, i) => i + 1);
  const score = (count: number) => {
    const main = base.slice(0, count),
      returning = base.slice(count);
    const mainUse =
      (main.reduce((n, c) => n + c.width, 0) +
        Math.max(...returning.map((c) => c.depth)) +
        clearanceMm) /
      kitchen.room.width;
    const returnUse =
      (returning.reduce((n, c) => n + c.width, 0) +
        Math.max(...main.map((c) => c.depth)) +
        clearanceMm) /
      kitchen.room.depth;
    return (
      Math.abs(mainUse - returnUse) -
      (kitchen.cornerPlan?.mainCount === count ? 0.05 : 0)
    );
  };
  splits.sort((a, b) => score(a) - score(b));
  let lastError = "Өрөөнд багтах булангийн хувилбар олдсонгүй.";
  for (const mainCount of splits) {
    try {
      return arrangeKitchenCorner(kitchen, { side, clearanceMm, mainCount });
    } catch (error) {
      lastError = (error as Error).message;
    }
  }
  throw new Error(lastError);
}

/** Reserve an empty corner; keep every rectangular catalog SKU at its authored size. */
export function arrangeKitchenCorner(
  kitchen: ModularKitchen,
  input: KitchenCornerPlan,
): ModularKitchen {
  const base = kitchen.cabinets.filter((c) => c.type === "base");
  const plan = parseKitchenCornerPlan(input, base.length)!;
  if (base.some((c) => c.corner))
    throw new Error(
      "Тусгай булангийн шүүгээтэй төслийг эхлээд тусад нь байрлуулна уу.",
    );
  const next: ModularKitchen = JSON.parse(JSON.stringify(kitchen));
  const main = next.cabinets
    .filter((c) => c.type === "base")
    .slice(0, plan.mainCount);
  const returning = next.cabinets
    .filter((c) => c.type === "base")
    .slice(plan.mainCount);
  const sideDepth = Math.max(...returning.map((c) => c.depth));
  const mainDepth = Math.max(...main.map((c) => c.depth));
  if (
    main.some((c) => c.depth !== mainDepth || c.height !== main[0].height) ||
    returning.some((c) => c.depth !== sideDepth || c.height !== main[0].height)
  )
    throw new Error(
      "Булангийн хоёр талын доод шүүгээ ижил өндөр, тал бүртээ ижил гүнтэй байна.",
    );
  const totalWidth = main.reduce((sum, c) => sum + c.width, 0);
  const inset = sideDepth + plan.clearanceMm;
  let along =
    plan.side === "left" ? inset : kitchen.room.width - inset - totalWidth;
  for (const c of main) {
    c.position = { x: along + c.width / 2, z: c.depth / 2, y: 0, rotation: 0 };
    c.corner = false;
    along += c.width;
  }
  along = mainDepth + plan.clearanceMm;
  for (const c of returning) {
    c.position = {
      x: plan.side === "left" ? c.depth / 2 : kitchen.room.width - c.depth / 2,
      z: along + c.width / 2,
      y: 0,
      rotation: plan.side === "left" ? Math.PI / 2 : -Math.PI / 2,
    };
    c.corner = false;
    along += c.width;
  }
  for (const wall of next.cabinets.filter((c) => c.type === "wall")) {
    const old = kitchen.cabinets.find((c) => c.id === wall.id)!;
    const support = [...base].sort(
      (a, b) =>
        Math.hypot(
          a.position.x - old.position.x,
          a.position.z - old.position.z,
        ) -
        Math.hypot(
          b.position.x - old.position.x,
          b.position.z - old.position.z,
        ),
    )[0];
    const moved = next.cabinets.find((c) => c.id === support.id)!;
    const rot = moved.position.rotation;
    wall.position = {
      ...moved.position,
      x: moved.position.x + (Math.sin(rot) * (wall.depth - moved.depth)) / 2,
      z: moved.position.z + (Math.cos(rot) * (wall.depth - moved.depth)) / 2,
    };
    wall.autoElevation = true;
    wall.corner = false;
  }
  next.cornerPlan = plan;
  next.layout = plan.side === "left" ? "l-left" : "l-right";
  next.countertopLayout = undefined;
  const placed = resolveElevations(next);
  const problem = placementIssues(placed).find(
    (issue) => issue.severity === "error",
  );
  if (problem)
    throw new Error(
      `${problem.message} Булангийн тал эсвэл шүүгээний тоог солино уу.`,
    );
  return placed;
}
