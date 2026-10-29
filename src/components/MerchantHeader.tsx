"use client";
import type { ReactNode } from "react";

import { ChevronRight, House, Menu } from "lucide-react";
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
}) {
  return (
    <div className="merchant-location-bar">
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
      <nav className="merchant-breadcrumbs" aria-label="Хуудасны зам">
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
      <div className="merchant-header-actions">
        {balances}
        <DashboardThemeToggle owner={owner} role="merchant" />
        {!hideNotifications && <MerchantNotifications owner={owner} onKitchens={onKitchens} />}
      </div>

    </div>
  );
}
