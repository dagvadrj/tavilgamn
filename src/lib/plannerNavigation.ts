"use client";
export type PlannerNavigation = {
  id: number;
  from: string;
  target: string;
  kind: "room" | "kitchen";
  startedAt: number;
};
let pending: PlannerNavigation | null = null,
  sequence = 0;
const listeners = new Set<() => void>();
export function plannerNavigationTarget(href: string, currentHref: string) {
  try {
    const current = new URL(currentHref),
      target = new URL(href, current);
    // Match useSearchParams().toString(), including equivalent %20 and + encoding.
    const key = (url: URL) =>
      url.pathname + (url.search ? "?" + url.searchParams.toString() : "");
    if (
      target.origin !== current.origin ||
      !["/planner", "/kitchen"].includes(target.pathname) ||
      key(target) === key(current)
    )
      return null;
    return {
      from: key(current),
      target: key(target),
      kind:
        target.pathname === "/planner"
          ? ("room" as const)
          : ("kitchen" as const),
    };
  } catch {
    return null;
  }
}
export function startPlannerNavigation(href: string) {
  if (typeof window === "undefined") return;
  const target = plannerNavigationTarget(href, window.location.href);
  if (!target) return;
  pending = { ...target, id: ++sequence, startedAt: performance.now() };
  listeners.forEach((listener) => listener());
}
export function finishPlannerNavigation(id: number) {
  if (pending?.id !== id) return;
  pending = null;
  listeners.forEach((listener) => listener());
}
export const subscribePlannerNavigation = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getPlannerNavigation = () => pending;
export const getServerPlannerNavigation = () => null;
