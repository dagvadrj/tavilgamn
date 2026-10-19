"use client";

import { DashboardNavigation } from "@/features/dashboard/DashboardNavigation";
import "@/features/dashboard/dashboard-v14.css";

import { useCallback, useState, type ReactNode, type RefObject } from "react";
import { AdminSidebar, ADMIN_TABS, type AdminTab } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";
import type { DashboardPreferences } from "@/features/dashboard/preferences";
import "@/features/dashboard/merchant-theme.css";
import "@/features/dashboard/merchant-inputs.css";
import "@/features/dashboard/admin-theme.css";

export function AdminShell({
  active,
  onChange,
  userName,
  preferences,
  panelRef,
  children,
}: {
  active: AdminTab;
  onChange: (tab: AdminTab) => void;
  userName: string;
  preferences: DashboardPreferences;
  panelRef?: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const changeTab = (tab: AdminTab) => {
    closeMenu();
    onChange(tab);
  };
  const label =
    ADMIN_TABS.find((item) => item.id === active)?.label ?? ADMIN_TABS[0].label;
  return (
    <div
      className="admin-shell dashboard-shell dashboard-themed-shell dashboard-v14"
      data-theme={preferences.theme}
      data-density={preferences.density}
      data-text-size={preferences.textSize}
    >
      <AdminSidebar
        active={active}
        onChange={changeTab}
        userName={userName}
        open={menuOpen}
        onClose={closeMenu}
      />
      <div className="admin-workspace dashboard-workspace">
        <AdminHeader
          navigation={
            <DashboardNavigation
              tabs={ADMIN_TABS.filter((tab) =>
                ["dashboard", "merchants", "furniture", "orders"].includes(
                  tab.id,
                ),
              )}
              active={active}
              onChange={changeTab}
            />
          }
          userName={userName}
          activeLabel={label}
          menuOpen={menuOpen}
          onToggleMenu={() => setMenuOpen((value) => !value)}
          onProducts={() => changeTab("furniture")}
          onMessages={() => changeTab("messages")}
          onSettings={() => changeTab("settings")}
          onProfile={() => changeTab("profile")}
        />
        <main
          id="main-content"
          className="admin-content dashboard-content"
          ref={panelRef}
          tabIndex={-1}
          aria-label={label}
        >
          {children}
        </main>
        <footer className="admin-footer">
          <span>© {new Date().getFullYear()} tavilga.mn</span>
          <span>Удирдлагын систем</span>
        </footer>
      </div>
    </div>
  );
}
