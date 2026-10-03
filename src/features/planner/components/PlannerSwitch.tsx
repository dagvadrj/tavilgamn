"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function PlannerSwitch({ active }: { active: "room" | "kitchen" }) {
  const diagnostic = useSearchParams().get("performance") === "1" ? "?performance=1" : "";
  return <nav className="studio-switch" aria-label="Төлөвлөгч сонгох">
    {active === "room" ? <span aria-current="page">Өрөө</span> : <Link href={`/planner${diagnostic}`}>Өрөө</Link>}
    {active === "kitchen" ? <span aria-current="page">Гал тогоо</span> : <Link href={`/kitchen${diagnostic}`}>Гал тогоо</Link>}
  </nav>;
}
