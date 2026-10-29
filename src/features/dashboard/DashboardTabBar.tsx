"use client";

import type { LucideIcon } from "lucide-react";
import { Menu, Plus } from "lucide-react";
import type { ReactNode } from "react";

export type TabBarItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

/** Mobile bottom navigation: two destinations, a create action, one more, and the full menu. */
export function DashboardTabBar({
  items,
  active,
  onChange,
  create,
  onMenu,
}: {
  items: [TabBarItem, TabBarItem, TabBarItem];
  active: string;
  onChange: (id: string) => void;
  create: ReactNode;
  onMenu: () => void;
}) {
  const tab = (item: TabBarItem) => {
    const Icon = item.icon;
    return (
      <button
        key={item.id}
        type="button"
        aria-current={active === item.id ? "page" : undefined}
        onClick={() => onChange(item.id)}
      >
        <span className="dashboard-tabbar-icon">
          <Icon size={20} strokeWidth={1.6} aria-hidden="true" />
          {!!item.badge && <span className="dashboard-nav-badge">{item.badge}</span>}
        </span>
        {item.label}
      </button>
    );
  };
  return (
    <nav className="dashboard-tabbar" aria-label="Үндсэн цэс">
      {tab(items[0])}
      {tab(items[1])}
      {create}
      {tab(items[2])}
      <button type="button" onClick={onMenu}>
        <span className="dashboard-tabbar-icon">
          <Menu size={20} strokeWidth={1.6} aria-hidden="true" />
        </span>
        Цэс
      </button>
    </nav>
  );
}

/** "+ Шинэ": one entry point for every create action. */
export function DashboardCreateMenu({
  actions,
  compact = false,
}: {
  actions: { label: string; onSelect: () => void }[];
  compact?: boolean;
}) {
  return (
    <details className={`dashboard-menu dashboard-create${compact ? " is-compact" : ""}`}>
      <summary aria-label="Шинээр үүсгэх">
        <Plus size={compact ? 20 : 15} aria-hidden="true" />
        {!compact && "Шинэ"}
      </summary>
      <div className="dashboard-menu-list">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={(event) => {
              event.currentTarget.closest("details")?.removeAttribute("open");
              action.onSelect();
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </details>
  );
}
