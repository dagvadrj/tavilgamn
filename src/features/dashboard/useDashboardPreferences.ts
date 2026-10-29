"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  DASHBOARD_DARK_QUERY,
  DASHBOARD_THEME_KEY,
  dashboardPreferencesKey,
  parseDashboardPreferences,
  resolveDashboardTheme,
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

function subscribeScheme(onChange: () => void) {
  const media = window.matchMedia?.(DASHBOARD_DARK_QUERY);
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}

const prefersDark = () =>
  Boolean(window.matchMedia?.(DASHBOARD_DARK_QUERY).matches);

/** <html data-dashboard-theme> is the only theme switch the stylesheets read. */
function applyTheme(raw: string | null) {
  const { theme } = parseDashboardPreferences(raw);
  document.documentElement.dataset.dashboardTheme = resolveDashboardTheme(
    theme,
    prefersDark(),
  );
  try {
    window.localStorage.setItem(DASHBOARD_THEME_KEY, theme);
  } catch {
    // The inline script falls back to the system theme.
  }
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
  const dark = useSyncExternalStore(subscribeScheme, prefersDark, () => false);
  const preferences = useMemo(() => parseDashboardPreferences(raw), [raw]);
  useEffect(() => {
    // Read storage directly: during hydration `raw` is still the server snapshot.
    // Accounts without saved settings keep the device theme set before paint.
    const stored = getSnapshot();
    if (stored !== null) applyTheme(stored);
  }, [getSnapshot, raw, dark]);
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
  return {
    preferences,
    theme: resolveDashboardTheme(preferences.theme, dark),
    updatePreferences,
  };
}
