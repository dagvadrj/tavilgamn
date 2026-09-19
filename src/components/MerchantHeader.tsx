"use client";

import Link from "next/link";
import { Bell, ChevronDown, MessageSquare, Search } from "lucide-react";

export function MerchantHeader({
  userName,
  storeName,
  onProducts,
}: {
  userName: string;
  storeName: string;
  onProducts: () => void;
}) {
  const initial = userName.trim().slice(0, 1).toUpperCase() || "M";

  return (
    <header className="merchant-topbar">
      <div className="merchant-topbar-title">
        <strong>{storeName}</strong>
        <span>Merchant workspace</span>
      </div>

      <div className="merchant-topbar-actions">
        <button
          type="button"
          className="merchant-header-search"
          onClick={onProducts}
        >
          <Search size={18} />
          <span>Бүтээгдэхүүн хайх...</span>
          <kbd>⌘ K</kbd>
        </button>

        <button
          type="button"
          className="merchant-header-icon"
          aria-label="Мэдэгдэл"
        >
          <Bell size={19} strokeWidth={1.7} />
          <span className="merchant-notification-dot" />
        </button>

        <button
          type="button"
          className="merchant-header-icon"
          aria-label="Зурвас"
        >
          <MessageSquare size={19} strokeWidth={1.7} />
        </button>

        <Link href="/account" className="merchant-header-profile">
          <span className="merchant-header-avatar">{initial}</span>

          <span className="merchant-header-user">
            <strong>{userName}</strong>
            <small>Merchant</small>
          </span>

          <ChevronDown size={15} />
        </Link>
      </div>
    </header>
  );
}
