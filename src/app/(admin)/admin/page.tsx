"use client";

import { useDraftState } from "@/hooks/useDashboardDraft";
import { useState, useEffect, useRef, useCallback } from "react";
import { AdminMessages } from "@/components/AdminMessages";
import {
  AdminSidebar,
  ADMIN_TABS,
  type AdminTab,
} from "@/components/AdminSidebar";
import { AdminMerchants } from "@/components/AdminMerchants";
import { AdminHeader } from "@/components/AdminHeader";
import { AdminAnalytics } from "@/components/AdminAnalytics";
import { AdminKitchenDesigns } from "@/components/AdminKitchenDesigns";
import { Package, ShieldCheck } from "lucide-react";
import { OrderHistory } from "@/components/OrderHistory";
import { AdminUsers } from "@/components/AdminUsers";
import { AdminProducts } from "@/components/AdminProducts";
import { useRouter } from "next/navigation";
import { useAuth } from "@/store/auth";
import "./admin.css";
import "./admin-dark.css";
import { ModelsTab } from "@/features/admin-models/ModelsTab";
import { DashboardSettings } from "@/features/dashboard/DashboardSettings";
import { DashboardAccount } from "@/features/dashboard/DashboardAccount";
import { loginPathForDestination } from "@/lib/authRedirect";
import { useDashboardPreferences } from "@/features/dashboard/useDashboardPreferences";
import "@/features/dashboard/dashboard-usability.css";
import "@/features/dashboard/dashboard-reference.css";

const TABS = ADMIN_TABS;

type Tab = AdminTab;

export default function AdminPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
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
    setMenuOpen(false);
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
      <main id="main-content" className="admin-gate" role="status">
        <ShieldCheck size={32} strokeWidth={1.4} />
        <p>Удирдлагын эрхийг шалгаж байна…</p>
      </main>
    );
  const active = TABS.find((t) => t.id === tab) ?? TABS[0];
  return (
    <div
      className="admin-shell dashboard-shell"
      data-density={preferences.density}
      data-text-size={preferences.textSize}
    >
      <AdminSidebar
        active={tab}
        onChange={selectTab}
        userName={user.name}
        open={menuOpen}
        onClose={closeMenu}
      />

      <div className="admin-workspace dashboard-workspace">
        <AdminHeader
          userName={user.name}
          activeLabel={active.label}
          onProducts={() => selectTab("furniture")}
          onMessages={() => selectTab("messages")}
          onSettings={() => selectTab("settings")}
          onProfile={() => selectTab("profile")}
          menuOpen={menuOpen}
          onToggleMenu={() => setMenuOpen((open) => !open)}
        />

        <main
          id="main-content"
          className="admin-content dashboard-content"
          ref={panelRef}
          tabIndex={-1}
          aria-label={active.label}
        >
          {tab === "dashboard" && <AdminAnalytics />}
          {tab === "merchants" && <AdminMerchants />}

          {tab === "furniture" && (
            <AdminProducts
              onAddModel={() => selectTab("models")}
              initialProductId={openProductId}
              onProductOpened={handleProductOpened}
            />
          )}

          {tab === "orders" && (
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

          {tab === "users" && <AdminUsers />}

          {tab === "messages" && <AdminMessages key={user.id} />}

          {tab === "models" && (
            <ModelsTab
              owner={user.id}
              onOpenProduct={(productId) => {
                setOpenProductId(productId);
                selectTab("furniture");
              }}
            />
          )}

          {tab === "kitchens" && <AdminKitchenDesigns owner={user.id} />}
          {tab === "settings" && (
            <DashboardSettings
              role="admin"
              preferences={preferences}
              onChange={updatePreferences}
              onProfile={() => selectTab("profile")}
            />
          )}
          {tab === "profile" && <DashboardAccount key={user.id} role="admin" />}
        </main>

        <footer className="admin-footer">
          <span>© {new Date().getFullYear()} tavilga.mn</span>

          <span>Удирдлагын систем</span>
        </footer>
      </div>
    </div>
  );
}
