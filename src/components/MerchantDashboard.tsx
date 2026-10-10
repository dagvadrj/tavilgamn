"use client";

import { useDraftState } from "@/hooks/useDashboardDraft";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw, Store as StoreIcon } from "lucide-react";
import { MerchantAnalytics } from "@/components/MerchantAnalytics";
import { useAuth } from "@/store/auth";
import type { Store } from "@/lib/types";
import {
  merchantLocationPath,
  readMerchantLocation,
} from "@/lib/merchantNavigation";
import { MerchantOrders } from "@/components/MerchantOrders";
import { MerchantShell } from "@/components/MerchantShell";
import type { MerchantTab } from "@/components/MerchantSidebar";
import { MerchantKitchenDesigns } from "@/components/MerchantKitchenDesigns";
import { MerchantKitchenQuotes } from "@/components/MerchantKitchenQuotes";
import { merchantRequest } from "@/features/merchant/merchantApi";
import { MerchantOverview } from "@/features/merchant/MerchantOverview";
import { StoreProfile } from "@/features/merchant/StoreProfile";
import { MerchantProducts } from "@/features/merchant/MerchantProducts";
import { DashboardSettings } from "@/features/dashboard/DashboardSettings";
import { useDashboardPreferences } from "@/features/dashboard/useDashboardPreferences";
import "@/features/dashboard/dashboard-usability.css";

export function MerchantDashboard() {
  const router = useRouter();
  const user = useAuth((state) => state.user);
  const role = useAuth((state) => state.role);
  const initialized = useAuth((state) => state.initialized);
  const initialize = useAuth((state) => state.initialize);
  useEffect(() => {
    void initialize();
  }, [initialize]);
  useEffect(() => {
    if (initialized && !user) router.replace("/login?next=/merchant");
  }, [initialized, user, router]);
  if (!initialized || !user)
    return (
      <main
        id="main-content"
        className="merchant-gate merchant-state"
        role="status"
      >
        <StoreIcon size={32} />
        Дэлгүүрийн эрхийг шалгаж байна…
      </main>
    );
  if (role !== "merchant")
    return (
      <main id="main-content" className="merchant-gate merchant-state">
        <StoreIcon size={32} />
        <h1>Худалдаа эрхлэгчийн хэсэг</h1>
        <p>Дэлгүүр нээхийн тулд админаар merchant эрхээ идэвхжүүлнэ үү.</p>
        <Link href="/account" className="btn-ghost">
          Миний бүртгэл
        </Link>
      </main>
    );
  return (
    <MerchantWorkspace key={user.id} owner={user.id} userName={user.name} />
  );
}

function MerchantWorkspace({
  owner,
  userName,
}: {
  owner: string;
  userName: string;
}) {
  const [store, setStore] = useState<Store | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [tab, setTab] = useDraftState<MerchantTab>(
    `merchant:${owner}:navigation`,
    "tab",
    "overview",
  );
  const [focusedKitchenId, setFocusedKitchenId] = useState<string | null>(null);
  const { preferences, updatePreferences } = useDashboardPreferences(
    owner,
    "merchant",
  );

  useEffect(() => {
    const syncLocation = () => {
      const location = readMerchantLocation(window.location.search);
      setTab(location.tab);
      setFocusedKitchenId(location.designId);
    };

    if (window.location.search) syncLocation();
    window.addEventListener("popstate", syncLocation);
    return () => window.removeEventListener("popstate", syncLocation);
  }, [setTab]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setLoaded(false);
    setError(null);

    merchantRequest<{ store: Store | null }>("/api/merchant/store", owner, {
      signal: controller.signal,
    })
      .then((result) => {
        if (active) {
          setStore(result.store);
          setLoaded(true);
        }
      })
      .catch((reason) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Дэлгүүрийг ачаалж чадсангүй.",
          );
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [owner, refresh]);

  const changeTab = (next: MerchantTab) => {
    setTab(next);
    setFocusedKitchenId(null);

    window.history.pushState(
      window.history.state,
      "",
      merchantLocationPath(
        window.location.pathname,
        window.location.search,
        window.location.hash,
        next,
      ),
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const openKitchen = (designId?: string) => {
    setTab("kitchens");
    setFocusedKitchenId(designId ?? null);

    window.history.pushState(
      window.history.state,
      "",
      merchantLocationPath(
        window.location.pathname,
        window.location.search,
        window.location.hash,
        "kitchens",
        designId,
      ),
    );
  };

  return (
    <MerchantShell
      active={tab}
      onChange={changeTab}
      userName={userName}
      storeName={store?.name ?? "Миний дэлгүүр"}
      owner={owner}
      onOpenKitchen={openKitchen}
      hasStore={Boolean(store)}
      preferences={preferences}
    >
      {tab === "settings" ? (
        <DashboardSettings
          role="merchant"
          preferences={preferences}
          onChange={updatePreferences}
          onStore={() => changeTab("store")}
        />
      ) : !loaded ? (
        error ? (
          <div className="merchant-load-state">
            <p role="alert" className="merchant-error">
              {error}
            </p>

            <button
              type="button"
              className="btn-ghost"
              onClick={() => setRefresh((value) => value + 1)}
            >
              <RefreshCw size={16} />
              Дахин оролдох
            </button>
          </div>
        ) : (
          <div className="merchant-load-state" role="status">
            Дэлгүүрийг ачаалж байна…
          </div>
        )
      ) : (
        <>
          {tab === "overview" &&
            store &&
            preferences.overview !== "inventory" && (
              <MerchantAnalytics owner={owner} />
            )}
          {tab === "overview" &&
            (!store || preferences.overview !== "sales") && (
              <MerchantOverview
                owner={owner}
                store={store}
                onProducts={() => changeTab("products")}
                onStore={() => changeTab("store")}
              />
            )}

          {tab === "store" && (
            <StoreProfile
              key={owner}
              owner={owner}
              store={store}
              onSave={(savedStore) => {
                setStore(savedStore);
              }}
            />
          )}

          {tab === "products" && store && <MerchantProducts owner={owner} />}

          {!store &&
            ["products", "orders", "quotes", "kitchens"].includes(tab) && (
              <MerchantOverview
                owner={owner}
                store={null}
                onProducts={() => changeTab("products")}
                onStore={() => changeTab("store")}
              />
            )}

          {tab === "orders" && store && <MerchantOrders owner={owner} />}
          {tab === "quotes" && store && <MerchantKitchenQuotes owner={owner} />}

          {tab === "kitchens" && store && (
            <MerchantKitchenDesigns
              owner={owner}
              focusedDesignId={focusedKitchenId}
            />
          )}
        </>
      )}
    </MerchantShell>
  );
}
