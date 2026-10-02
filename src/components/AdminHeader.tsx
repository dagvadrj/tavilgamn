"use client";

import Link from "next/link";
import { Menu, MessageSquare, Package, Search } from "lucide-react";

export function AdminHeader({
  userName,
  activeLabel,
  onProducts,
  onOrders,
  onMessages,
  menuOpen,
  onToggleMenu,
}: {
  userName: string;
  activeLabel: string;
  onProducts: () => void;
  onOrders: () => void;
  onMessages: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
}) {
  const initial = userName.trim().slice(0, 1).toUpperCase() || "A";

  return (
    <header className="admin-topbar dashboard-topbar">
      <div className="dashboard-header-title">
        <button type="button" className="dashboard-menu-toggle" aria-label="Админ цэс нээх" aria-expanded={menuOpen} aria-controls="admin-navigation" onClick={onToggleMenu}><Menu size={20} /></button>
        <div><strong>{activeLabel}</strong><small>Админ · Удирдлагын самбар</small></div>
      </div>

      <div className="admin-topbar-actions dashboard-header-actions">
        <button
          type="button"
          className="admin-header-search"
          onClick={onProducts}
          aria-label="Бүтээгдэхүүний хайлт руу очих"
        >
          <Search size={18} strokeWidth={1.7} />

          <span>Бүтээгдэхүүн хайх</span>
        </button>

        <button
          type="button"
          className="admin-header-icon"
          aria-label="Захиалгуудыг нээх"
          onClick={onOrders}
        >
          <Package size={19} strokeWidth={1.7} />
        </button>

        <button
          type="button"
          className="admin-header-icon"
          aria-label="Зурвасууд"
          onClick={onMessages}
        >
          <MessageSquare size={19} strokeWidth={1.7} />
        </button>

        <Link href="/account" className="admin-profile" aria-label={`${userName} — миний бүртгэл`}>
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
