"use client";
import { ModularKitchenPlanner } from "./ModularKitchenPlanner";
import { useAuth } from "@/store/auth";
import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import "./kitchen-planner.css";
import { KitchenSuggestionWizard } from "./KitchenSuggestionWizard";

export function KitchenPlanner() {
  return (
    <Suspense fallback={<p role="status">Загварыг бэлдэж байна…</p>}>
      <Editor />
    </Suspense>
  );
}
function Editor() {
  const params = useSearchParams();
  const query = params.toString();
  const { user, initialized, initialize } = useAuth();
  useEffect(() => {
    void initialize();
  }, [initialize]);
  const openEditor =
    params.get("new") !== "1" &&
    ["editor", "design", "draft", "importGuest"].some((key) => params.has(key));
  if (!openEditor) return <KitchenSuggestionWizard />;
  if (!initialized)
    return (
      <p className="container-page py-10" role="status">
        Загварыг бэлдэж байна…
      </p>
    );
  return (
    <ModularKitchenPlanner
      key={`${user?.id ?? "guest"}:${query}`}
      queryString={query}
    />
  );
}
