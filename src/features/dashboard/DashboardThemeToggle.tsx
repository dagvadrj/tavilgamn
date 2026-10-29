"use client";

import { Moon, Sun } from "lucide-react";
import { useDashboardPreferences } from "./useDashboardPreferences";

/** One-tap light/dark switch; "system" stays available in Settings. */
export function DashboardThemeToggle({
  owner,
  role,
}: {
  owner: string;
  role: "admin" | "merchant";
}) {
  const { theme, updatePreferences } = useDashboardPreferences(owner, role);
  const next = theme === "dark" ? "light" : "dark";
  const label = next === "dark" ? "Харанхуй горим" : "Гэгээлэг горим";
  return (
    <button
      type="button"
      className="dashboard-theme-toggle"
      aria-label={`${label} руу шилжих`}
      title={label}
      onClick={() => updatePreferences({ theme: next })}
    >
      {theme === "dark" ? (
        <Sun size={19} strokeWidth={1.8} aria-hidden="true" />
      ) : (
        <Moon size={19} strokeWidth={1.8} aria-hidden="true" />
      )}
    </button>
  );
}
