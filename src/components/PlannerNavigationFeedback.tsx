"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { PageSkeleton } from "./PageSkeleton";
import {
  finishPlannerNavigation,
  getPlannerNavigation,
  getServerPlannerNavigation,
  subscribePlannerNavigation,
} from "@/lib/plannerNavigation";
export function PlannerNavigationFeedback() {
  const pathname = usePathname(),
    search = useSearchParams().toString();
  const pending = useSyncExternalStore(
    subscribePlannerNavigation,
    getPlannerNavigation,
    getServerPlannerNavigation,
  );
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!pending) return;
    const current = pathname + (search ? "?" + search : "");
    if (current === pending.target || current !== pending.from)
      finishPlannerNavigation(pending.id);
  }, [pathname, search, pending]);
  useEffect(() => {
    setSlow(false);
    if (!pending) return;
    const timer = window.setTimeout(() => setSlow(true), 8000);
    return () => window.clearTimeout(timer);
  }, [pending]);
  useEffect(() => {
    const clear = () => {
      const value = getPlannerNavigation();
      if (value) finishPlannerNavigation(value.id);
    };
    window.addEventListener("pagehide", clear);
    window.addEventListener("pageshow", clear);
    return () => {
      window.removeEventListener("pagehide", clear);
      window.removeEventListener("pageshow", clear);
    };
  }, []);
  if (!pending) return null;
  return (
    <div
      className="planner-navigation-feedback"
      data-planner-navigation={pending.kind}
    >
      <PageSkeleton
        variant="planner"
        layout={pending.kind === "room" ? "room-start" : "kitchen-planner"}
        label={
          pending.kind === "room"
            ? "Өрөөний төлөвлөгчийг нээж байна…"
            : "Гал тогооны төлөвлөгчийг нээж байна…"
        }
      />
      {slow && (
        <div className="planner-navigation-help">
          <p role="status">
            Холболт удаж байна. Хуудас нээгдэхийг хүлээж байна…
          </p>
          <button
            type="button"
            onClick={() => finishPlannerNavigation(pending.id)}
          >
            Ачаалалтын дэлгэцийг нуух
          </button>
        </div>
      )}
    </div>
  );
}
