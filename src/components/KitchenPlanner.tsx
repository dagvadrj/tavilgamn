"use client";
import { ModularKitchenPlanner } from "./ModularKitchenPlanner";
import { useAuth } from "@/store/auth";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import "./kitchen-planner.css";

export function KitchenPlanner() {
  return <Suspense fallback={<p role="status">Загварыг бэлдэж байна…</p>}><Editor /></Suspense>;
}
function Editor() {
  const query = useSearchParams().toString();
  const { user, initialized } = useAuth();
  if (!initialized) return <p className="container-page py-10" role="status">Загварыг бэлдэж байна…</p>;
  return <ModularKitchenPlanner key={`${user?.id ?? "guest"}:${query}`} queryString={query} />;
}
