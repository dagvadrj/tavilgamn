"use client";

import { PageSkeleton } from "@/components/PageSkeleton";

import { useDraftState } from "@/hooks/useDashboardDraft";
import { useState, useEffect, useRef, useCallback } from "react";
import { AdminMessages } from "@/components/AdminMessages";
import { ADMIN_TABS, type AdminTab } from "@/components/AdminSidebar";
import { AdminMerchants } from "@/components/AdminMerchants";
import { AdminShell } from "@/components/AdminShell";
import { AdminAnalytics } from "@/components/AdminAnalytics";
import { AdminMerchantGrowth } from "@/features/merchant/AdminMerchantGrowth";
import { AdminKitchenDesigns } from "@/components/AdminKitchenDesigns";
import { AdminKitchenModules } from "@/components/AdminKitchenModules";
import { AdminRoomTemplates } from "@/components/AdminRoomTemplates";
import { Package } from "lucide-react";
import { OrderHistory } from "@/components/OrderHistory";
import { AdminUsers } from "@/components/AdminUsers";
import { AdminProducts } from "@/components/AdminProducts";
import { useRouter } from "next/navigation";
import { useAuth } from "@/store/auth";
import "@/app/(admin)/admin/admin.css";
import "@/app/(admin)/admin/admin-dark.css";
import { ModelsTab } from "@/features/admin-models/ModelsTab";
import { DashboardSettings } from "@/features/dashboard/DashboardSettings";
import { AdminHomepageSettings } from "@/features/home-interior/AdminHomepageSettings";
import { DashboardAccount } from "@/features/dashboard/DashboardAccount";
import { loginPathForDestination } from "@/lib/authRedirect";
import { useDashboardPreferences } from "@/features/dashboard/useDashboardPreferences";
import "@/features/dashboard/dashboard-usability.css";
import "@/features/dashboard/dashboard-reference.css";

const TABS = ADMIN_TABS;

type Tab = AdminTab;

export function AdminDashboard({
  kitchenDesignId,
}: {
  kitchenDesignId?: string;
}) {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const [tab, setTab] = useDraftState<Tab>(
    `admin:${user?.id ?? "guest"}:navigation`,
    "tab",
    "dashboard",
  );
  const role = useAuth((s) => s.role);
  const initialized = useAuth((s) => s.initialized);
  const initializeAuth = useAuth((s) => s.initialize);
  const [openProductId, setOpenProductId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { preferences, updatePreferences } = useDashboardPreferences(
    user?.id ?? "guest",
    "admin",
  );
  const handleProductOpened = useCallback(() => setOpenProductId(null), []);
  useEffect(() => {
    if (!TABS.some((item) => item.id === tab)) setTab("dashboard");
  }, [tab, setTab]);
  useEffect(() => {
    const syncLocation = () => {
      const requested = new URLSearchParams(window.location.search).get("tab");
      setTab(TABS.find((item) => item.id === requested)?.id ?? "dashboard");
    };
    if (window.location.search) syncLocation();
    window.addEventListener("popstate", syncLocation);
    return () => window.removeEventListener("popstate", syncLocation);
  }, [setTab]);
  useEffect(() => {
    void initializeAuth();
  }, [initializeAuth]);
  useEffect(() => {
    if (!initialized) return;
    if (!user)
      router.replace(
        loginPathForDestination(
          window.location.pathname + window.location.search,
        ),
      );
    else if (role !== "admin") router.replace("/");
  }, [initialized, user, role, router]);

  const selectTab = (next: Tab) => {
    setTab(next);
    if (kitchenDesignId) {
      router.push(`/admin${next === "dashboard" ? "" : `?tab=${next}`}`);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (next === "dashboard") params.delete("tab");
    else params.set("tab", next);
    const search = params.toString();
    window.history.pushState(
      window.history.state,
      "",
      `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`,
    );
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() =>
      panelRef.current?.focus({ preventScroll: true }),
    );
  };

  if (!initialized || !user || role !== "admin")
    return (
      <main id="main-content">
        <PageSkeleton
          variant="dashboard"
          label="Удирдлагын эрхийг шалгаж байна…"
        />
      </main>
    );
  const currentTab = kitchenDesignId ? "kitchens" : tab;
  return (
    <AdminShell
      active={currentTab}
      onChange={selectTab}
      userName={user.name}
      preferences={preferences}
      panelRef={panelRef}
    >
      {currentTab === "dashboard" && <AdminAnalytics />}
      {currentTab === "merchant-ops" && <AdminMerchantGrowth />}
      {currentTab === "merchants" && <AdminMerchants />}

      {currentTab === "furniture" && (
        <AdminProducts
          onAddModel={() => selectTab("models")}
          initialProductId={openProductId}
          onProductOpened={handleProductOpened}
        />
      )}

      {currentTab === "orders" && (
        <div>
          <div className="admin-page-heading">
            <div>
              <span className="admin-eyebrow">БОРЛУУЛАЛТ</span>

              <h1>Захиалгууд</h1>

              <p>Захиалгын мэдээлэл, төлбөрийн төлөвийг хянах.</p>
            </div>

            <span className="admin-heading-icon">
              <Package size={25} strokeWidth={1.5} />
            </span>
          </div>

          <OrderHistory admin />
        </div>
      )}

      {currentTab === "users" && <AdminUsers />}

      {currentTab === "messages" && <AdminMessages key={user.id} />}

      {currentTab === "models" && (
        <ModelsTab
          owner={user.id}
          onOpenProduct={(productId) => {
            setOpenProductId(productId);
            selectTab("furniture");
          }}
        />
      )}

      {currentTab === "kitchens" && (
        <AdminKitchenDesigns
          key={kitchenDesignId ?? "list"}
          owner={user.id}
          designId={kitchenDesignId}
        />
      )}
      {currentTab === "kitchen-library" && (
        <AdminKitchenModules key={user.id} owner={user.id} />
      )}
      {currentTab === "rooms" && (
        <AdminRoomTemplates key={user.id} owner={user.id} />
      )}
      {currentTab === "settings" && (
        <>
          <DashboardSettings
            role="admin"
            preferences={preferences}
            onChange={updatePreferences}
            onProfile={() => selectTab("profile")}
          />
          <AdminHomepageSettings key={user.id} />
        </>
      )}
      {currentTab === "profile" && (
        <DashboardAccount key={user.id} role="admin" />
      )}
    </AdminShell>
  );
}
