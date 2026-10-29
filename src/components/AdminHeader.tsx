"use client";
import type { ReactNode } from "react";

import { Menu, MessageSquare, Package, Settings } from "lucide-react";

export function AdminHeader({
  navigation,
  themeToggle,
  activeLabel,
  onProducts,
  onMessages,
  onSettings,
  menuOpen,
  onToggleMenu,
}: {
  navigation?: ReactNode;
  themeToggle?: ReactNode;
  userName: string;
  activeLabel: string;
  onProducts: () => void;
  onMessages: () => void;
  onSettings: () => void;
  onProfile: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
}) {

  return (
    <header className="admin-topbar dashboard-topbar">
      <div className="dashboard-header-title">
        <button
          type="button"
          className="dashboard-menu-toggle"
          aria-label={menuOpen ? "Админ цэс хаах" : "Админ цэс нээх"}
          aria-expanded={menuOpen}
          aria-controls="admin-navigation"
          onClick={onToggleMenu}
        >
          <Menu size={20} />
        </button>
        <div>
          <small>АДМИН · УДИРДЛАГЫН САМБАР</small>
          <strong>{activeLabel}</strong>
        </div>
      </div>

      {navigation}
      <div className="admin-topbar-actions dashboard-header-actions">
        {themeToggle}
        <button
          type="button"
          className="admin-header-search"
          onClick={onProducts}
          aria-label="Бүтээгдэхүүн удирдах"
        >
          <Package size={18} strokeWidth={1.7} />

          <span>Бүтээгдэхүүн</span>
        </button>

        <button
          type="button"
          className="admin-header-icon"
          aria-label="Самбарын тохиргоо"
          title="Самбарын тохиргоо"
          onClick={onSettings}
        >
          <Settings size={19} strokeWidth={1.7} />
        </button>

        <button
          type="button"
          className="admin-header-icon"
          aria-label="Зурвасууд"
          title="Ирсэн зурвасууд"
          onClick={onMessages}
        >
          <MessageSquare size={19} strokeWidth={1.7} />
        </button>


      </div>
    </header>
  );
}
