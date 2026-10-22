"use client";

import { PageSkeleton } from "@/components/PageSkeleton";
import { ModularKitchenPlanner } from "./ModularKitchenPlanner";
import { useAuth } from "@/store/auth";
import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import "./kitchen-planner.css";

export function KitchenPlanner() {
  return (
    <Suspense fallback={<KitchenPlannerLoading />}>
      <Editor />
    </Suspense>
  );
}

function KitchenPlannerLoading() {
  return (
    <PageSkeleton
      variant="planner"
      layout="kitchen-planner"
      label="Төлөвлөх орчныг ачаалж байна…"
    />
  );
}

function Editor() {
  const params = useSearchParams();
  const query = params.toString();
  const { user, initialized, initialize } = useAuth();
  useEffect(() => {
    void initialize();
  }, [initialize]);
  if (!initialized) return <KitchenPlannerLoading />;
  return (
    <ModularKitchenPlanner
      key={`${user?.id ?? "guest"}:${query}`}
      queryString={query}
    />
  );
}
