"use client";

import Link from "next/link";
import {
  Armchair,
  Box,
  LayoutDashboard,
  Layers3,
  Mail,
  Package,
  Settings,
  Users,
  Store,
  CookingPot,
} from "lucide-react";

export const ADMIN_TABS = [
  {
    id: "dashboard",
    label: "Ерөнхий тойм",
    short: "Тойм",
    icon: LayoutDashboard,
  },
  {
    id: "merchants",
    label: "Merchant дэлгүүрүүд",
    short: "Merchant",
    icon: Store,
  },
  {
    id: "furniture",
    label: "Бүтээгдэхүүн",
    short: "Бараа",
    icon: Box,
  },
  {
    id: "orders",
    label: "Захиалгууд",
    short: "Захиалга",
    icon: Package,
  },
  {
    id: "users",
    label: "Хэрэглэгчид",
    short: "Хэрэглэгч",
    icon: Users,
  },
  {
    id: "messages",
    label: "Ирсэн зурвас",
    short: "Зурвас",
    icon: Mail,
  },
  {
    id: "models",
    label: "3D загварууд",
    short: "3D",
    icon: Layers3,
  },
  {
    id: "kitchens",
    label: "Гал тогооны загварууд",
    short: "Гал тогоо",
    icon: CookingPot,
  },
] as const;

export type AdminTab = (typeof ADMIN_TABS)[number]["id"];

export function AdminSidebar({
  active,
  onChange,
}: {
  active: AdminTab;
  onChange: (tab: AdminTab) => void;
}) {
  return (
    <aside className="admin-sidebar">
      <Link href="/" className="admin-sidebar-brand" aria-label="tavilga.mn">
        <span>
          <Armchair size={22} strokeWidth={1.7} />
        </span>

        <small>Furni</small>
      </Link>

      <nav className="admin-sidebar-nav" aria-label="Админ цэс">
        {ADMIN_TABS.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              title={item.label}
              aria-current={active === item.id ? "page" : undefined}
              className={active === item.id ? "active" : ""}
              onClick={() => onChange(item.id)}
            >
              <span className="admin-nav-icon">
                <Icon size={20} strokeWidth={1.7} />
              </span>

              <small>{item.short}</small>
            </button>
          );
        })}
      </nav>

      <Link href="/account" className="admin-sidebar-settings" title="Тохиргоо">
        <Settings size={19} strokeWidth={1.7} />
      </Link>
    </aside>
  );
}
