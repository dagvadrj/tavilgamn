"use client";

import dynamic from "next/dynamic";
import { PageSkeleton } from "@/components/PageSkeleton";

import { useDraftState } from "@/hooks/useDashboardDraft";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw, Store as StoreIcon } from "lucide-react";
import { useAuth } from "@/store/auth";
import type { Store } from "@/lib/types";
import {
  merchantLocationPath,
  readMerchantLocation,
} from "@/lib/merchantNavigation";
import { MerchantOrders } from "@/components/MerchantOrders";
import { MerchantShell } from "@/components/MerchantShell";
import type { MerchantTab } from "@/components/MerchantSidebar";
const MerchantKitchenDesigns = dynamic(
  () =>
    import("@/components/MerchantKitchenDesigns").then(
      (module) => module.MerchantKitchenDesigns,
    ),
  { loading: () => <PageSkeleton variant="dashboard" compact /> },
);
const MerchantKitchenDesignDetail = dynamic(
  () =>
    import("@/components/MerchantKitchenDesignDetail").then(
      (module) => module.MerchantKitchenDesignDetail,
    ),
  { loading: () => <PageSkeleton variant="dashboard" compact /> },
);
const MerchantKitchenQuotes = dynamic(
  () =>
    import("@/components/MerchantKitchenQuotes").then(
      (module) => module.MerchantKitchenQuotes,
    ),
  { loading: () => <PageSkeleton variant="dashboard" compact /> },
);
import { merchantRequest } from "@/features/merchant/merchantApi";
import { MerchantOverview } from "@/features/merchant/MerchantOverview";
import { MerchantActivation } from "@/features/merchant/MerchantActivation";
import { MerchantWallet } from "@/features/merchant/MerchantWallet";
import { MerchantDeliveryBoard } from "@/features/merchant/MerchantDeliveryBoard";
import { MerchantBranches, MerchantStaff, MerchantFeedback, MerchantAssistant } from "@/features/merchant/MerchantOperations";
import { MerchantTeamWorkspace } from "@/features/merchant/MerchantTeamWorkspace";
const StoreProfile = dynamic(
  () =>
    import("@/features/merchant/StoreProfile").then(
      (module) => module.StoreProfile,
    ),
  { loading: () => <PageSkeleton variant="dashboard" compact /> },
);
const MerchantProducts = dynamic(
  () =>
    import("@/features/merchant/MerchantProducts").then(
      (module) => module.MerchantProducts,
    ),
  { loading: () => <PageSkeleton variant="dashboard" compact /> },
);
import { DashboardSettings } from "@/features/dashboard/DashboardSettings";
import { DashboardAccount } from "@/features/dashboard/DashboardAccount";
import {
  accountPathForRole,
  loginPathForDestination,
} from "@/lib/authRedirect";
import { useDashboardPreferences } from "@/features/dashboard/useDashboardPreferences";
import "@/features/dashboard/dashboard-usability.css";
import "@/features/dashboard/dashboard-reference.css";

export function MerchantDashboard({
  kitchenDesignId,
}: {
  kitchenDesignId?: string;
} = {}) {
  const router = useRouter();
  const user = useAuth((state) => state.user);
  const role = useAuth((state) => state.role);
  const initialized = useAuth((state) => state.initialized);
  const initialize = useAuth((state) => state.initialize);
  useEffect(() => {
    void initialize();
  }, [initialize]);
  useEffect(() => {
    if (initialized && !user)
      router.replace(
        loginPathForDestination(
          window.location.pathname + window.location.search,
        ),
      );
  }, [initialized, user, router]);
  if (!initialized || !user)
    return (
      <main id="main-content">
        <PageSkeleton
          variant="dashboard"
          label="Дэлгүүрийн эрхийг шалгаж байна…"
        />
      </main>
    );
  if (role !== "merchant")
    return <MerchantTeamWorkspace owner={user.id} userName={user.name} fallback={(
      <main id="main-content" className="merchant-gate merchant-state">
        <StoreIcon size={32} />
        <h1>Худалдаа эрхлэгчийн хэсэг</h1>
        <p>Дэлгүүр нээхийн тулд админаар merchant эрхээ идэвхжүүлнэ үү.</p>
        <p>Ажилтан бол дэлгүүрийн эзэмшигчийн бүртгэсэн имэйлээр нэвтэрч, имэйлээ баталгаажуулна уу.</p>
        <Link href={accountPathForRole(role)} className="btn-ghost">
          Миний бүртгэл
        </Link>
      </main>
    )} />;
  return (
    <MerchantWorkspace
      key={user.id}
      owner={user.id}
      userName={user.name}
      kitchenDesignId={kitchenDesignId}
    />
  );
}

function MerchantWorkspace({
  owner,
  userName,
  kitchenDesignId,
}: {
  owner: string;
  userName: string;
  kitchenDesignId?: string;
}) {
  const router = useRouter();
  const [store, setStore] = useState<Store | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [tab, setTab] = useDraftState<MerchantTab>(
    `merchant:${owner}:navigation`,
    "tab",
    "overview",
  );
  const [createProduct, setCreateProduct] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const { preferences, updatePreferences } = useDashboardPreferences(
    owner,
    "merchant",
  );

  useEffect(() => {
    const syncLocation = () => {
      const location = readMerchantLocation(window.location.search);
      setTab(location.tab);
      if (location.designId)
        router.replace(`/merchant/kitchens/${location.designId}`);
    };

    if (window.location.search) syncLocation();
    window.addEventListener("popstate", syncLocation);
    return () => window.removeEventListener("popstate", syncLocation);
  }, [setTab, router]);

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
    if (kitchenDesignId) {
      router.push(merchantLocationPath("/merchant", "", "", next));
      return;
    }
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
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  };

  const openKitchen = (designId?: string) => {
    if (designId) router.push(`/merchant/kitchens/${designId}`);
    else changeTab("kitchens");
  };

  return (
    <MerchantShell
      active={kitchenDesignId ? "kitchens" : tab}
      onChange={changeTab}
      userName={userName}
      storeName={store?.name ?? "Миний дэлгүүр"}
      owner={owner}
      onOpenKitchen={openKitchen}
      hasStore={Boolean(store)}
      preferences={preferences}
    >
      {!loaded && error && tab === "overview" && (
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
            Дэлгүүрийн мэдээллийг дахин ачаалах
          </button>
        </div>
      )}
      {tab === "settings" && !kitchenDesignId ? (
        <DashboardSettings
          role="merchant"
          preferences={preferences}
          onChange={updatePreferences}
          onStore={() => changeTab("store")}
          onProfile={() => changeTab("profile")}
          onEditLayout={
            store
              ? () => {
                  setCustomizing(true);
                  changeTab("overview");
                }
              : undefined
          }
        />
      ) : tab === "profile" && !kitchenDesignId ? (
        <DashboardAccount role="merchant" onStore={() => changeTab("store")} />
      ) : !loaded && (tab !== "overview" || Boolean(kitchenDesignId)) ? (
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
          <PageSkeleton
            variant="dashboard"
            compact
            label="Дэлгүүрийг ачаалж байна…"
          />
        )
      ) : kitchenDesignId ? (
        store ? (
          <MerchantKitchenDesignDetail
            key={kitchenDesignId}
            owner={owner}
            designId={kitchenDesignId}
          />
        ) : (
          <MerchantOverview
            owner={owner}
            store={null}
            onProducts={() => changeTab("products")}
            onStore={() => changeTab("store")}
          />
        )
      ) : (
        <>
          {tab === "overview" && (
            <MerchantOverview
              owner={owner}
              store={store}
              storePending={!loaded}
              onDelivery={() => changeTab("delivery")}
              onGrowth={(section) => changeTab(section)}
              mode={preferences.overview}
              customizing={customizing}
              onCustomize={setCustomizing}
              onProducts={() => changeTab("products")}
              onStore={() => changeTab("store")}
              onAddProduct={() => {
                setCreateProduct(true);
                changeTab("products");
              }}
              onQuotes={() => changeTab("quotes")}
              onOrders={() => changeTab("orders")}
            />
          )}

          {tab === "activation" && store && (
            <MerchantActivation
              owner={owner}
              onStore={() => changeTab("store")}
            />
          )}
          {tab === "wallet" && store && (
            <MerchantWallet
              owner={owner}
              onSetup={() => changeTab("activation")}
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

          {tab === "products" && store && (
            <MerchantProducts
              owner={owner}
              initialCreate={createProduct}
              onCreateOpened={() => setCreateProduct(false)}
            />
          )}

          {!store &&
            [
              "products",
              "orders",
              "delivery",
              "quotes",
              "kitchens",
              "activation",
              "wallet",
              "branches", "staff", "reviews", "assistant", "returns",
            ].includes(tab) && (
              <MerchantOverview
                owner={owner}
                store={null}
                onProducts={() => changeTab("products")}
                onStore={() => changeTab("store")}
              />
            )}

          {tab === "orders" && store && (
            <MerchantOrders
              owner={owner}
              onDelivery={() => changeTab("delivery")}
            />
          )}
          {tab === "delivery" && store && (
            <MerchantDeliveryBoard key={owner} owner={owner} />
          )}
          {tab === "branches" && store && <MerchantBranches owner={owner} />}
          {tab === "staff" && store && <MerchantStaff owner={owner} />}
          {tab === "reviews" && store && <MerchantFeedback owner={owner} />}
          {tab === "returns" && store && <MerchantFeedback owner={owner} cases />}
          {tab === "assistant" && store && <MerchantAssistant owner={owner} />}
          {tab === "quotes" && store && <MerchantKitchenQuotes owner={owner} />}

          {tab === "kitchens" && store && (
            <MerchantKitchenDesigns owner={owner} />
          )}
        </>
      )}
    </MerchantShell>
  );
}
