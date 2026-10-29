"use client";
import type { ReactNode } from "react";

import { ChevronRight, House, Menu, Search } from "lucide-react";
import { MerchantNotifications } from "./MerchantNotifications";
import { DashboardThemeToggle } from "@/features/dashboard/DashboardThemeToggle";

/** A location trail replaces the dashboard's large header panel. */
export function MerchantHeader({
  navigation,
  balances,
  storeName,
  owner,
  onHome,
  onKitchens,
  activeLabel,
  sidebarOpen,
  onToggleSidebar,
  hideNotifications,
  slotRef,
  create,
  onSearch,
}: {
  navigation?: ReactNode;
  balances?: ReactNode;
  userName?: string;
  onProfile?: () => void;
  storeName: string;
  owner: string;
  onHome: () => void;
  onKitchens: (designId?: string) => void;
  activeLabel: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  hideNotifications?: boolean;
  /** Page-owned controls are portalled here, like the admin top bar. */
  slotRef?: (element: HTMLDivElement | null) => void;
  create?: ReactNode;
  onSearch?: () => void;
}) {
  return (
    <div className="merchant-location-bar dashboard-topbar">
      <button
        type="button"
        className="dashboard-menu-toggle"
        aria-label={sidebarOpen ? "Дэлгүүрийн цэс хаах" : "Дэлгүүрийн цэс нээх"}
        aria-controls="merchant-dashboard-navigation"
        aria-expanded={sidebarOpen}
        onClick={onToggleSidebar}
      >
        <Menu size={20} />
      </button>
      <nav className="merchant-breadcrumbs dashboard-breadcrumb" aria-label="Хуудасны зам">
        <ol>
          <li>
            <button
              type="button"
              onClick={onHome}
              aria-label="Дэлгүүрийн ерөнхий тойм"
            >
              <House size={16} />
              <span>{storeName}</span>
            </button>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">{activeLabel}</span>
          </li>
        </ol>
      </nav>
      {navigation}
      <div className="dashboard-topbar-slot" ref={slotRef} />
      <div className="merchant-header-actions dashboard-header-actions">
        {balances}
        {onSearch && (
          <button
            type="button"
            className="dashboard-icon-button dashboard-mobile-only"
            aria-label="Хайх"
            onClick={onSearch}
          >
            <Search size={17} />
          </button>
        )}
        {!hideNotifications && <MerchantNotifications owner={owner} onKitchens={onKitchens} />}
        <DashboardThemeToggle owner={owner} role="merchant" />
        {create}
      </div>

    </div>
  );
}
