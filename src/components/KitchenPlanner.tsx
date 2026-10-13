"use client";

import { PageSkeleton } from "@/components/PageSkeleton";
import { ModularKitchenPlanner } from "./ModularKitchenPlanner";
import { KitchenSuggestionWizard } from "./KitchenSuggestionWizard";
import { useAuth } from "@/store/auth";
import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { LayoutGrid, LoaderCircle } from "lucide-react";
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
    <PageSkeleton variant="planner" label="Төлөвлөх орчныг ачаалж байна…" />
  );
}

function Editor() {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.toString();
  const { user, initialized, initialize } = useAuth();
  useEffect(() => {
    void initialize();
  }, [initialize]);
  if (!initialized) return <KitchenPlannerLoading />;
  if (params.get("setup") === "1") {
    return (
      <KitchenSuggestionWizard onBack={() => router.push("/planner?setup=1")} />
    );
  }
  return (
    <ModularKitchenPlanner
      key={`${user?.id ?? "guest"}:${query}`}
      queryString={query}
    />
  );
}
