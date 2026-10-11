"use client";
import { ModularKitchenPlanner } from "./ModularKitchenPlanner";
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
    <section className="grid min-h-dvh place-items-center bg-brand-surface px-5 py-12 text-ink">
      <div
        className="w-full max-w-md rounded-2xl border border-brand-border bg-brand-white p-8 text-center sm:p-10"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-kitchen-tint text-kitchen">
          <LayoutGrid size={26} aria-hidden="true" />
        </div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-brand-muted">
          tavilga.mn · Гал тогооны төлөвлөгч
        </p>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Загварыг бэлдэж байна…
        </h1>
        <p className="mt-3 text-sm leading-6 text-brand-muted">
          Таны төлөвлөх орчныг ачаалж байна. Түр хүлээнэ үү.
        </p>
        <LoaderCircle
          size={24}
          className="mx-auto mt-6 text-kitchen motion-safe:animate-spin"
          aria-hidden="true"
        />
      </div>
    </section>
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
