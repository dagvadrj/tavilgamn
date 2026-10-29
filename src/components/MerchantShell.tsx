"use client";

import { DashboardNavigation } from "@/features/dashboard/DashboardNavigation";
import { DashboardFormAssist } from "@/features/dashboard/DashboardFormAssist";
import { MerchantBalanceChip } from "@/features/merchant/MerchantGrowth";
import "@/features/dashboard/dashboard-v14.css";

import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  MerchantSidebar,
  MERCHANT_TABS,
  type MerchantTab,
} from "./MerchantSidebar";
import { MerchantHeader } from "./MerchantHeader";
import { DashboardMotion } from "@/features/dashboard/DashboardMotion";
import "@/features/merchant/merchant-stats.css";
import type { DashboardPreferences } from "@/features/dashboard/preferences";
import "@/features/dashboard/merchant-theme.css";
import "@/features/dashboard/merchant-inputs.css";
import "@/features/merchant/merchant-workspace.css";

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
  allowedTabs,
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
  allowedTabs?: MerchantTab[];
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
      className="merchant-app-shell dashboard-shell dashboard-themed-shell dashboard-mono"
      data-density={preferences?.density ?? "comfortable"}
      data-text-size={preferences?.textSize ?? "standard"}
    >
      <DashboardFormAssist />
      <MerchantSidebar
        active={active}
        onChange={changeTab}
        hasStore={hasStore}
        userName={userName}
        storeName={storeName}
        open={sidebarOpen}
        onClose={closeSidebar}
        allowedTabs={allowedTabs}
      />

      <div className="merchant-workspace dashboard-workspace">
        <MerchantHeader
          balances={
            !allowedTabs && (
              <MerchantBalanceChip
                owner={owner}
                enabled={hasStore}
                onOpen={() => changeTab("wallet")}
              />
            )
          }
          navigation={
            <DashboardNavigation
              tabs={MERCHANT_TABS.filter((tab) =>
                allowedTabs
                  ? allowedTabs.includes(tab.id)
                  : ["overview", "sales", "inventory", "progress"].includes(
                      tab.id,
                    ),
              ).map((tab) => ({
                ...tab,
                disabled: !hasStore && tab.id !== "overview",
              }))}
              active={active}
              onChange={changeTab}
            />
          }
          storeName={storeName}
          userName={userName}
          onProfile={allowedTabs ? undefined : () => changeTab("profile")}
          hideNotifications={!!allowedTabs}
          owner={owner}
          onHome={() => changeTab(allowedTabs?.[0] ?? "overview")}
          onKitchens={onOpenKitchen}
          activeLabel={activeLabel}
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
          <DashboardMotion page={active} rootRef={panelRef} />
        </main>
      </div>
    </div>
  );
}
