"use client";

import { Menu, MessageSquare, Package, Settings } from "lucide-react";

export function AdminHeader({
  userName,
  activeLabel,
  onProducts,
  onMessages,
  onSettings,
  onProfile,
  menuOpen,
  onToggleMenu,
}: {
  userName: string;
  activeLabel: string;
  onProducts: () => void;
  onMessages: () => void;
  onSettings: () => void;
  onProfile: () => void;
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
          <small>АДМИН · УДИРДЛАГЫН САМБАР</small>
          <strong>{activeLabel}</strong>
        </div>
      </div>

      <div className="admin-topbar-actions dashboard-header-actions">
        {activeLabel === "Ерөнхий тойм" && (
          <span className="reference-period">30 хоног</span>
        )}
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

        <button
          type="button"
          onClick={onProfile}
          className="admin-profile"
          aria-label={`${userName} — миний бүртгэл`}
        >
          <span className="admin-avatar">{initial}</span>

          <span className="admin-profile-copy">
            <strong>{userName}</strong>
            <small>Админ</small>
          </span>
        </button>
      </div>
    </header>
  );
}
