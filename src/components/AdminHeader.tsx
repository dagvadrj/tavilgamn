"use client";

import Link from "next/link";
import { Bell, ChevronDown, MessageSquare, Search } from "lucide-react";

export function AdminHeader({
  userName,
  activeLabel,
  onProducts,
  onOrders,
  onMessages,
}: {
  userName: string;
  activeLabel: string;
  onProducts: () => void;
  onOrders: () => void;
  onMessages: () => void;
}) {
  const initial = userName.trim().slice(0, 1).toUpperCase() || "A";

  return (
    <header className="admin-topbar">
      <div className="admin-header-title">
        <strong>{activeLabel}</strong>
        <span>Admin workspace</span>
      </div>

      <div className="admin-topbar-actions">
        <button
          type="button"
          className="admin-header-search"
          onClick={onProducts}
        >
          <Search size={18} strokeWidth={1.7} />

          <span>Бүтээгдэхүүн хайх...</span>

          <kbd>⌘ K</kbd>
        </button>

        <button
          type="button"
          className="admin-header-icon"
          aria-label="Захиалгын мэдэгдэл"
          onClick={onOrders}
        >
          <Bell size={19} strokeWidth={1.7} />

          <span className="admin-header-notification" />
        </button>

        <button
          type="button"
          className="admin-header-icon"
          aria-label="Зурвасууд"
          onClick={onMessages}
        >
          <MessageSquare size={19} strokeWidth={1.7} />
        </button>

        <Link href="/account" className="admin-profile">
          <span className="admin-avatar">{initial}</span>

          <span className="admin-profile-copy">
            <strong>{userName}</strong>
            <small>Administrator</small>
          </span>

          <ChevronDown size={14} />
        </Link>
      </div>
    </header>
  );
}
