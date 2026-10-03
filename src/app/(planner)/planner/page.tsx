import { RoomPlanner } from "@/components/RoomPlanner";
import { Suspense } from "react";
export const metadata = { title: "Өрөө төлөвлөгч" };

export default function PlannerPage() {
  return (
    <Suspense fallback={<p role="status">Өрөөний загвар бэлдэж байна...</p>}>
      <RoomPlanner />
    </Suspense>
  );
}
