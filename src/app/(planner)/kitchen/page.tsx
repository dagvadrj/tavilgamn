import type { Metadata } from "next";
import { KitchenPlannerEntry } from "@/features/planner/components/PlannerEntry";

export const metadata: Metadata = {
  title: "Гал тогооны гарнитур төлөвлөх — tavilga.mn",
  description: "Гарнитурын хэмжээ, шүүгээ, хаалга, өнгө болон гадаргууг 3D орчинд тохируулна.",
};

export default function KitchenPage() {
  return <KitchenPlannerEntry />;
}
