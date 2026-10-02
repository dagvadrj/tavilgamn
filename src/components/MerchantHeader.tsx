"use client";

import Link from "next/link";
import { ChevronDown, Menu, MessageSquareQuote, Package } from "lucide-react";
import { MerchantNotifications } from "./MerchantNotifications";

export function MerchantHeader({
  userName,
  storeName,
  owner,
  onProducts,
  onKitchens,
  onQuotes,
  activeLabel,
  hasStore,
  sidebarOpen,
  onToggleSidebar,
}: {
  userName: string;
  storeName: string;
  owner: string;
  onProducts: () => void;
  onKitchens: (designId?: string) => void;
  onQuotes: () => void;
  activeLabel: string;
  hasStore: boolean;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  const initial = userName.trim().slice(0, 1).toUpperCase() || "M";

  return (
    <header className="merchant-topbar dashboard-topbar">
      <div className="merchant-topbar-heading">
        <button
          type="button"
          className="dashboard-menu-toggle"
          aria-label="Дэлгүүрийн цэс нээх"
          aria-controls="merchant-dashboard-navigation"
          aria-expanded={sidebarOpen}
          onClick={onToggleSidebar}
        ><Menu size={21} /></button>
        <div className="merchant-topbar-title dashboard-header-title">
          <strong>{activeLabel}</strong>
          <span>{storeName}</span>
        </div>
      </div>

      <div className="merchant-topbar-actions dashboard-header-actions">
        <button
          type="button"
          className="merchant-header-search"
          onClick={onProducts}
          disabled={!hasStore}
        >
          <Package size={17} />
          <span>Бүтээгдэхүүн</span>
        </button>

        <MerchantNotifications owner={owner} onKitchens={onKitchens} />

        <button
          type="button"
          className="merchant-header-icon"
          aria-label="Үнийн хүсэлтүүд"
          title="Үнийн хүсэлтүүд"
          onClick={onQuotes}
          disabled={!hasStore}
        >
          <MessageSquareQuote size={19} strokeWidth={1.7} />
        </button>

        <Link href="/account" className="merchant-header-profile">
          <span className="merchant-header-avatar">{initial}</span>

          <span className="merchant-header-user">
            <strong>{userName}</strong>
            <small>Худалдаа эрхлэгч</small>
          </span>

          <ChevronDown size={15} />
        </Link>
      </div>
    </header>
  );
}
