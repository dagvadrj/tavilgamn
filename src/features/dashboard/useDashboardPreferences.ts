"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  dashboardPreferencesKey,
  parseDashboardPreferences,
  type DashboardPreferences,
} from "./preferences";

const PREFERENCES_EVENT = "tavilga:dashboard-preferences";
const serverSnapshot = () => null;

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(PREFERENCES_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(PREFERENCES_EVENT, onChange);
  };
}

export function useDashboardPreferences(
  owner: string,
  role: "admin" | "merchant",
) {
  const key = dashboardPreferencesKey(owner, role);
  const getSnapshot = useCallback(() => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }, [key]);
  const raw = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
  const preferences = useMemo(() => parseDashboardPreferences(raw), [raw]);
  const updatePreferences = useCallback(
    (patch: Partial<DashboardPreferences>) => {
      try {
        const current = parseDashboardPreferences(
          window.localStorage.getItem(key),
        );
        window.localStorage.setItem(
          key,
          JSON.stringify({ ...current, ...patch }),
        );
        window.dispatchEvent(new Event(PREFERENCES_EVENT));
        return true;
      } catch {
        return false;
      }
    },
    [key],
  );
  return { preferences, updatePreferences };
}
