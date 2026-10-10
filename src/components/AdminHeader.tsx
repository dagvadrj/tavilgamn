"use client";

import Link from "next/link";
import { Menu, MessageSquare, Package, Settings } from "lucide-react";

export function AdminHeader({
  userName,
  activeLabel,
  onProducts,
  onMessages,
  onSettings,
  menuOpen,
  onToggleMenu,
}: {
  userName: string;
  activeLabel: string;
  onProducts: () => void;
  onMessages: () => void;
  onSettings: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
}) {
  const initial = userName.trim().slice(0, 1).toUpperCase() || "A";

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
          <strong>{activeLabel}</strong>
          <small>Админ · Удирдлагын самбар</small>
        </div>
      </div>

      <div className="admin-topbar-actions dashboard-header-actions">
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

        <Link
          href="/account"
          className="admin-profile"
          aria-label={`${userName} — миний бүртгэл`}
        >
          <span className="admin-avatar">{initial}</span>

          <span className="admin-profile-copy">
            <strong>{userName}</strong>
            <small>Админ</small>
          </span>
        </Link>
      </div>
    </header>
  );
}
