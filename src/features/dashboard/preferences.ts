export type DashboardPreferences = {
  density: "comfortable" | "compact";
  textSize: "standard" | "large";
  overview: "all" | "sales" | "inventory";
};

export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  density: "comfortable",
  textSize: "standard",
  overview: "all",
};

export function dashboardPreferencesKey(
  owner: string,
  role: "admin" | "merchant",
) {
  return `tavilga:dashboard:${role}:${owner}:preferences`;
}

export function parseDashboardPreferences(
  raw: string | null,
): DashboardPreferences {
  try {
    const value = raw ? JSON.parse(raw) : null;
    return {
      density: value?.density === "compact" ? "compact" : "comfortable",
      textSize: value?.textSize === "large" ? "large" : "standard",
      overview:
        value?.overview === "sales" || value?.overview === "inventory"
          ? value.overview
          : "all",
    };
  } catch {
    return { ...DEFAULT_DASHBOARD_PREFERENCES };
  }
}
