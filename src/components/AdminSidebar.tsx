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
  ArrowUpRight,
  CircleHelp,
} from "lucide-react";
import { DashboardSidebar } from "@/features/dashboard/components/DashboardSidebar";

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
  userName,
  open,
  onClose,
}: {
  active: AdminTab;
  onChange: (tab: AdminTab) => void;
  userName: string;
  open: boolean;
  onClose: () => void;
}) {
  const groups = [
    { label: "УДИРДЛАГА", tabs: ADMIN_TABS.filter(item => ["dashboard", "merchants", "furniture", "orders"].includes(item.id)) },
    { label: "ХЭРЭГЛЭГЧ БА КОНТЕНТ", tabs: ADMIN_TABS.filter(item => ["users", "messages", "models", "kitchens"].includes(item.id)) },
  ];
  return (
    <DashboardSidebar id="admin-navigation" label="Админы хажуугийн цэс" open={open} onClose={onClose}>
      <Link href="/" className="dashboard-brand" aria-label="tavilga.mn — дэлгүүр рүү очих">
        <span className="dashboard-brand-icon">
          <Armchair size={22} strokeWidth={1.7} />
        </span>
        <span className="dashboard-brand-copy"><strong>tavilga.mn</strong><small>{userName} · Админ</small></span>
      </Link>
      <nav aria-label="Админ цэс">
        {groups.map(group => <div className="dashboard-nav-group" key={group.label}>
          <p className="dashboard-nav-label">{group.label}</p>
          {group.tabs.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              title={item.label}
              aria-current={active === item.id ? "page" : undefined}
              className="dashboard-nav-button"
              onClick={() => onChange(item.id)}
            >
              <span className="dashboard-nav-icon">
                <Icon size={20} strokeWidth={1.7} />
              </span>

              <span>{item.label}</span>
            </button>
          );
          })}
        </div>)}
      </nav>
      <div className="dashboard-sidebar-bottom">
        <div className="dashboard-sidebar-note"><strong>Marketplace удирдлага</strong><p>Дэлгүүр, бараа болон захиалгын мэдээллээ нэг дор хянаарай.</p></div>
        <Link href="/account" className="dashboard-sidebar-link"><Settings size={18} />Миний бүртгэл</Link>
        <Link href="/about#contact" className="dashboard-sidebar-link"><CircleHelp size={18} />Тусламж, холбоо барих</Link>
        <Link href="/" className="dashboard-sidebar-link"><ArrowUpRight size={18} />Дэлгүүр рүү очих</Link>
      </div>
    </DashboardSidebar>
  );
}
