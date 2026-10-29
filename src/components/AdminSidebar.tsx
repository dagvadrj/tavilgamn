"use client";

import Link from "next/link";
import {
  Box,
  ChartColumn,
  ChevronDown,
  CookingPot,
  FileText,
  House,
  LayoutDashboard,
  Library,
  ListOrdered,
  MessageSquare,
  Package,
  Search,
  Settings,
  Store,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
  Warehouse,
} from "lucide-react";
import { DashboardSidebar } from "@/features/dashboard/components/DashboardSidebar";

export const ADMIN_TABS = [
  { id: "dashboard", label: "Тойм", short: "Тойм", icon: LayoutDashboard },
  { id: "sales", label: "Борлуулалт", short: "Борлуулалт", icon: TrendingUp },
  { id: "merchant-stats", label: "Дэлгүүрийн статистик", short: "Статистик", icon: ChartColumn },
  { id: "merchants", label: "Дэлгүүрүүд", short: "Дэлгүүр", icon: Store },
  { id: "furniture", label: "Бүтээгдэхүүн", short: "Бараа", icon: Package },
  { id: "orders", label: "Захиалга", short: "Захиалга", icon: ListOrdered },
  { id: "users", label: "Хэрэглэгчид", short: "Хэрэглэгч", icon: Users },
  { id: "messages", label: "Мессеж", short: "Мессеж", icon: MessageSquare },
  { id: "models", label: "3D загвар", short: "3D", icon: Box },
  { id: "kitchens", label: "Гал тогооны загварууд", short: "Гал тогоо", icon: CookingPot },
  { id: "merchant-ops", label: "Төлбөр, тооцоо", short: "Тооцоо", icon: Wallet },
  { id: "kitchen-library", label: "Гал тогооны GLB сан", short: "GLB сан", icon: Library },
  { id: "homepage", label: "Нүүр хуудас", short: "Нүүр хуудас", icon: House },
  { id: "rooms", label: "Бэлэн өрөөнүүд", short: "Өрөөнүүд", icon: Warehouse },
  { id: "contracts", label: "Гэрээ", short: "Гэрээ", icon: FileText },
  { id: "settings", label: "Тохиргоо", short: "Тохиргоо", icon: Settings },
  { id: "profile", label: "Миний бүртгэл", short: "Бүртгэл", icon: UserRound },
] as const;

export type AdminTab = (typeof ADMIN_TABS)[number]["id"];

/** Every admin page stays reachable; groups follow the monochrome redesign spec. */
export const ADMIN_NAV_GROUPS: { label?: string; tabs: AdminTab[] }[] = [
  { tabs: ["dashboard", "orders", "furniture", "models"] },
  {
    label: "Худалдаа",
    tabs: ["merchants", "merchant-ops", "contracts", "sales", "merchant-stats"],
  },
  { label: "Контент", tabs: ["kitchens", "kitchen-library", "rooms", "homepage"] },
  { label: "Систем", tabs: ["users", "messages", "settings"] },
];

export function AdminSidebar({
  active,
  onChange,
  userName,
  email,
  counts = {},
  badges = {},
  onSearch,
  open,
  onClose,
}: {
  active: AdminTab;
  onChange: (tab: AdminTab) => void;
  userName: string;
  email?: string;
  /** Muted totals beside an item. */
  counts?: Partial<Record<AdminTab, number>>;
  /** Highlighted counts that need action now. */
  badges?: Partial<Record<AdminTab, number>>;
  onSearch?: () => void;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <DashboardSidebar
      id="admin-navigation"
      label="Админы хажуугийн цэс"
      open={open}
      onClose={onClose}
    >
      <Link
        href="/"
        className="dashboard-workspace-switch"
        aria-label="Тавилга.mn — дэлгүүр рүү очих"
      >
        <span className="dashboard-workspace-mark" aria-hidden="true">
          т
        </span>
        <strong>Тавилга.mn</strong>
        <ChevronDown size={14} aria-hidden="true" />
      </Link>
      {onSearch && (
        <button type="button" className="dashboard-search" onClick={onSearch}>
          <Search size={15} aria-hidden="true" />
          <span>Хайх</span>
          <kbd>⌘K</kbd>
        </button>
      )}
      <nav aria-label="Админ цэс">
        {ADMIN_NAV_GROUPS.map((group) => (
          <div className="dashboard-nav-group" key={group.label ?? "main"}>
            {group.label && (
              <p className="dashboard-nav-label">{group.label}</p>
            )}
            {group.tabs.map((id) => {
              const item = ADMIN_TABS.find((tab) => tab.id === id)!;
              const Icon = item.icon;
              const badge = badges[id];
              const count = counts[id];
              return (
                <button
                  key={id}
                  type="button"
                  aria-label={item.label}
                  aria-current={active === id ? "page" : undefined}
                  className="dashboard-nav-button"
                  onClick={() => onChange(id)}
                >
                  <span className="dashboard-nav-icon">
                    <Icon size={16} strokeWidth={1.6} />
                  </span>
                  <span>{item.label}</span>
                  {badge ? (
                    <span className="dashboard-nav-badge">{badge}</span>
                  ) : count !== undefined ? (
                    <span className="dashboard-nav-count">
                      {count.toLocaleString("en-US")}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <button
        type="button"
        className="dashboard-user"
        aria-label="Миний бүртгэл"
        aria-current={active === "profile" ? "page" : undefined}
        onClick={() => onChange("profile")}
      >
        <span className="dashboard-user-avatar" aria-hidden="true">
          {userName.trim().charAt(0).toUpperCase() || "А"}
        </span>
        <span className="dashboard-user-copy">
          <strong>{userName}</strong>
          {email && <small>{email}</small>}
        </span>
      </button>
    </DashboardSidebar>
  );
}
