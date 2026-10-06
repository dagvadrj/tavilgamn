"use client";
import { useCallback, useMemo, useSyncExternalStore, type Dispatch, type SetStateAction } from "react";
import { createDashboardDraftStore } from "@/lib/dashboardDraftStore";
import { dashboardDraftBackend } from "@/lib/dashboardDraftStorage";

const drafts = createDashboardDraftStore(dashboardDraftBackend);
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", event => {
    if (!drafts.atRisk()) return;
    event.preventDefault();
    event.returnValue = "";
  });
}
export function useDraftState<T>(scope: string, field: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  // Match useState: the initializer applies once per scope/field.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const entry = useMemo(() => drafts.entry(scope, field, () => typeof initial === "function" ? (initial as () => T)() : initial), [scope, field]);
  const subscribe = useCallback((listener: () => void) => drafts.subscribe(entry, listener), [entry]);
  const value = useSyncExternalStore(subscribe, () => entry.value as T, () => entry.initial as T);
  const set = useCallback<Dispatch<SetStateAction<T>>>(next => {
    drafts.set(entry, typeof next === "function" ? (next as (value: T) => T)(entry.value as T) : next);
  }, [entry]);
  return [value, set];
}
export function useDraftStatus(scope: string) {
  const subscribe = useCallback((listener: () => void) => drafts.subscribeScope(scope, listener), [scope]);
  useSyncExternalStore(subscribe, () => drafts.version(scope), () => 0);
  return drafts.status(scope);
}
export const clearDashboardDraft = (scope: string, reset = true) => drafts.clear(scope, reset);
