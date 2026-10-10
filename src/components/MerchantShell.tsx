"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  MerchantSidebar,
  MERCHANT_TABS,
  type MerchantTab,
} from "./MerchantSidebar";
import { MerchantHeader } from "./MerchantHeader";
import type { DashboardPreferences } from "@/features/dashboard/preferences";

export function MerchantShell({
  active,
  onChange,
  userName,
  storeName,
  owner,
  onOpenKitchen,
  hasStore,
  preferences,
  children,
}: {
  active: MerchantTab;
  onChange: (tab: MerchantTab) => void;
  userName: string;
  storeName: string;
  owner: string;
  onOpenKitchen: (designId?: string) => void;
  hasStore: boolean;
  preferences?: DashboardPreferences;
  children: ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const changeTab = (tab: MerchantTab) => {
    onChange(tab);
    closeSidebar();
    requestAnimationFrame(() =>
      panelRef.current?.focus({ preventScroll: true }),
    );
  };
  const activeLabel =
    MERCHANT_TABS.find((item) => item.id === active)?.label ?? "Ерөнхий тойм";

  return (
    <div
      className="merchant-app-shell dashboard-shell"
      data-density={preferences?.density ?? "comfortable"}
      data-text-size={preferences?.textSize ?? "standard"}
    >
      <MerchantSidebar
        active={active}
        onChange={changeTab}
        hasStore={hasStore}
        userName={userName}
        storeName={storeName}
        open={sidebarOpen}
        onClose={closeSidebar}
      />

      <div className="merchant-workspace dashboard-workspace">
        <MerchantHeader
          userName={userName}
          storeName={storeName}
          owner={owner}
          onProducts={() => changeTab("products")}
          onKitchens={onOpenKitchen}
          onQuotes={() => changeTab("quotes")}
          onSettings={() => changeTab("settings")}
          onProfile={() => changeTab("profile")}
          activeLabel={activeLabel}
          hasStore={hasStore}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((value) => !value)}
        />

        <main
          id="main-content"
          className="merchant-content dashboard-content"
          ref={panelRef}
          aria-label={activeLabel}
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
