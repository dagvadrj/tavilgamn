"use client";

import { DashboardFormAssist } from "@/features/dashboard/DashboardFormAssist";
import { DashboardMotion } from "@/features/dashboard/DashboardMotion";
import { DashboardThemeToggle } from "@/features/dashboard/DashboardThemeToggle";
import { DashboardCommand } from "@/features/dashboard/DashboardCommand";
import {
  DashboardCreateMenu,
  DashboardTabBar,
} from "@/features/dashboard/DashboardTabBar";
import { TopbarSlotContext } from "@/features/dashboard/DashboardTopbarSlot";
import "@/features/dashboard/dashboard-v14.css";

import {
  useCallback,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Box, LayoutDashboard, ListOrdered } from "lucide-react";
import {
  AdminSidebar,
  ADMIN_NAV_GROUPS,
  ADMIN_TABS,
  type AdminTab,
} from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";
import type { DashboardPreferences } from "@/features/dashboard/preferences";
import "@/features/dashboard/merchant-theme.css";
import "@/features/dashboard/merchant-inputs.css";
import "@/features/dashboard/admin-theme.css";
import "@/features/dashboard/dashboard-mono.css";

const COMMANDS = ADMIN_NAV_GROUPS.flatMap((group) =>
  group.tabs.map((id) => ({
    id,
    label: ADMIN_TABS.find((tab) => tab.id === id)!.label,
    group: group.label,
  })),
).concat({ id: "profile", label: "Миний бүртгэл", group: "Систем" });

export function AdminShell({
  active,
  onChange,
  userName,
  email,
  owner,
  preferences,
  counts,
  badges,
  panelRef,
  children,
}: {
  active: AdminTab;
  onChange: (tab: AdminTab) => void;
  userName: string;
  email?: string;
  owner: string;
  preferences: DashboardPreferences;
  counts?: Partial<Record<AdminTab, number>>;
  badges?: Partial<Record<AdminTab, number>>;
  panelRef?: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const fallbackPanelRef = useRef<HTMLDivElement>(null);
  const contentRef = panelRef ?? fallbackPanelRef;
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const changeTab = (tab: AdminTab) => {
    closeMenu();
    onChange(tab);
  };
  const label =
    ADMIN_TABS.find((item) => item.id === active)?.label ?? ADMIN_TABS[0].label;
  const createActions = [
    { label: "Бүтээгдэхүүн", onSelect: () => changeTab("furniture") },
    { label: "3D загвар", onSelect: () => changeTab("models") },
    { label: "Бэлэн өрөө", onSelect: () => changeTab("rooms") },
  ];
  return (
    <div
      className="admin-shell dashboard-shell dashboard-themed-shell dashboard-mono"
      data-density={preferences.density}
      data-text-size={preferences.textSize}
    >
      <DashboardFormAssist />
      <AdminSidebar
        active={active}
        onChange={changeTab}
        userName={userName}
        email={email}
        counts={counts}
        badges={badges}
        onSearch={() => setSearchOpen(true)}
        open={menuOpen}
        onClose={closeMenu}
      />
      <div className="admin-workspace dashboard-workspace">
        <AdminHeader
          activeLabel={label}
          slotRef={setSlot}
          themeToggle={<DashboardThemeToggle owner={owner} role="admin" />}
          create={<DashboardCreateMenu actions={createActions} />}
          menuOpen={menuOpen}
          onToggleMenu={() => setMenuOpen((value) => !value)}
          onSearch={() => setSearchOpen(true)}
          onMessages={() => changeTab("messages")}
        />
        <main
          id="main-content"
          className="admin-content dashboard-content"
          ref={contentRef}
          tabIndex={-1}
          aria-label={label}
        >
          <TopbarSlotContext.Provider value={slot}>
            {children}
          </TopbarSlotContext.Provider>
          <DashboardMotion page={active} rootRef={contentRef} />
        </main>
      </div>
      <DashboardTabBar
        items={[
          { id: "dashboard", label: "Тойм", icon: LayoutDashboard },
          { id: "orders", label: "Захиалга", icon: ListOrdered },
          { id: "models", label: "3D", icon: Box, badge: badges?.models },
        ]}
        active={active}
        onChange={(id) => changeTab(id as AdminTab)}
        create={<DashboardCreateMenu actions={createActions} compact />}
        onMenu={() => setMenuOpen(true)}
      />
      <DashboardCommand
        items={COMMANDS}
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelect={(id) => changeTab(id as AdminTab)}
      />
    </div>
  );
}
