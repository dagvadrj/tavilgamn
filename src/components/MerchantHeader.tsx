"use client";

import Link from "next/link";
import { ChevronDown, MessageSquare, Search } from "lucide-react";
import { MerchantNotifications } from "./MerchantNotifications";

export function MerchantHeader({
  userName,
  storeName,
  owner,
  onProducts,
  onKitchens,
}: {
  userName: string;
  storeName: string;
  owner: string;
  onProducts: () => void;
  onKitchens: (designId?: string) => void;
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

        <MerchantNotifications owner={owner} onKitchens={onKitchens} />

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
