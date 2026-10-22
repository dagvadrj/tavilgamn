"use client";
import dynamic from "next/dynamic";
import { PageSkeleton } from "@/components/PageSkeleton";
const Room = dynamic(
  () => import("@/components/RoomPlanner").then((m) => m.RoomPlanner),
  {
    ssr: false,
    loading: () => (
      <PageSkeleton
        variant="planner"
        layout="room-start"
        label="Өрөөний төлөвлөгчийг ачаалж байна…"
      />
    ),
  },
);
const Kitchen = dynamic(
  () => import("@/components/KitchenPlanner").then((m) => m.KitchenPlanner),
  {
    ssr: false,
    loading: () => (
      <PageSkeleton
        variant="planner"
        layout="kitchen-planner"
        label="Гал тогооны төлөвлөгчийг ачаалж байна…"
      />
    ),
  },
);
export function RoomPlannerEntry() {
  return <Room />;
}
export function KitchenPlannerEntry() {
  return <Kitchen />;
}
