export type DashboardThemePreference = "system" | "light" | "dark";

export type DashboardPreferences = {
  theme: DashboardThemePreference;
  density: "comfortable" | "compact";
  textSize: "standard" | "large";
  overview: "all" | "sales" | "inventory";
};

export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = {
  theme: "system",
  density: "comfortable",
  textSize: "standard",
  overview: "all",
};

/** Last applied theme on this device; read before paint so the dashboard never flashes. */
export const DASHBOARD_THEME_KEY = "tavilga:dashboard:theme";
export const DASHBOARD_DARK_QUERY = "(prefers-color-scheme: dark)";

export function resolveDashboardTheme(
  theme: DashboardThemePreference,
  prefersDark: boolean,
): "light" | "dark" {
  return theme === "system" ? (prefersDark ? "dark" : "light") : theme;
}

// Inline, dependency-free copy of resolveDashboardTheme for the pre-hydration <script>.
export const DASHBOARD_THEME_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(DASHBOARD_THEME_KEY)});document.documentElement.dataset.dashboardTheme=t==="dark"||(t!=="light"&&matchMedia(${JSON.stringify(DASHBOARD_DARK_QUERY)}).matches)?"dark":"light"}catch(e){}`;

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
      theme:
        value?.theme === "light" || value?.theme === "dark"
          ? value.theme
          : "system",
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
