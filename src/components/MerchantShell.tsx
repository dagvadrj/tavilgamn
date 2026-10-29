"use client";

import { DashboardFormAssist } from "@/features/dashboard/DashboardFormAssist";
import { MerchantBalanceChip } from "@/features/merchant/MerchantGrowth";
import "@/features/dashboard/dashboard-v14.css";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { LayoutDashboard, Package, ShoppingBag } from "lucide-react";
import { useAuth } from "@/store/auth";
import { DashboardCommand } from "@/features/dashboard/DashboardCommand";
import {
  DashboardCreateMenu,
  DashboardTabBar,
} from "@/features/dashboard/DashboardTabBar";
import { TopbarSlotContext } from "@/features/dashboard/DashboardTopbarSlot";
import {
  MerchantSidebar,
  MERCHANT_NAV_GROUPS,
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
import "@/features/dashboard/dashboard-mono.css";

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const email = useAuth((state) => state.user?.email);
  const can = (tab: MerchantTab) =>
    (!allowedTabs || allowedTabs.includes(tab)) &&
    (hasStore || ["overview", "store", "settings", "profile"].includes(tab));
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
    MERCHANT_TABS.find((item) => item.id === active)?.label ?? "Тойм";
  const commands = MERCHANT_NAV_GROUPS.flatMap((group) =>
    group.tabs.filter(can).map((id) => ({
      id,
      label: MERCHANT_TABS.find((tab) => tab.id === id)!.label,
      group: group.label,
    })),
  );
  const createActions = (
    [
      ["products", "Бүтээгдэхүүн"],
      ["kitchens", "Гал тогооны загвар"],
      ["rooms", "Тохижуулсан өрөө"],
    ] as const
  )
    .filter(([tab]) => can(tab))
    .map(([tab, label]) => ({ label, onSelect: () => changeTab(tab) }));

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
        email={email}
        onSearch={() => setSearchOpen(true)}
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
          slotRef={setSlot}
          create={
            createActions.length ? (
              <DashboardCreateMenu actions={createActions} />
            ) : undefined
          }
          onSearch={() => setSearchOpen(true)}
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
          <TopbarSlotContext.Provider value={slot}>
            {children}
          </TopbarSlotContext.Provider>
          <DashboardMotion page={active} rootRef={panelRef} />
        </main>
      </div>
      {!allowedTabs && (
        <DashboardTabBar
          items={[
            { id: "overview", label: "Тойм", icon: LayoutDashboard },
            { id: "orders", label: "Захиалга", icon: ShoppingBag },
            { id: "products", label: "Бараа", icon: Package },
          ]}
          active={active}
          onChange={(id) => can(id as MerchantTab) && changeTab(id as MerchantTab)}
          create={
            createActions.length ? (
              <DashboardCreateMenu actions={createActions} compact />
            ) : (
              <span />
            )
          }
          onMenu={() => setSidebarOpen(true)}
        />
      )}
      <DashboardCommand
        items={commands}
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelect={(id) => changeTab(id as MerchantTab)}
      />
    </div>
  );
}
