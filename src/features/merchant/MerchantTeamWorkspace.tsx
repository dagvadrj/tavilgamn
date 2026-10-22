"use client";
import { useEffect, useState, type ReactNode } from "react";
import { MerchantShell } from "@/components/MerchantShell";
import type { MerchantTab } from "@/components/MerchantSidebar";
import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@/store/auth";
import type { WorkspaceAccess } from "@/lib/merchantOperations";
import {
  readMerchantLocation,
  merchantLocationPath,
} from "@/lib/merchantNavigation";
import { PageSkeleton } from "@/components/PageSkeleton";
import {
  MerchantBranches,
  MerchantFeedback,
  useOperations,
} from "./MerchantOperations";
import { MerchantDeliveryBoard } from "./MerchantDeliveryBoard";

export function MerchantTeamWorkspace({
  owner,
  userName,
  fallback,
}: {
  owner: string;
  userName: string;
  fallback: ReactNode;
}) {
  const [access, setAccess] = useState<WorkspaceAccess | null>(null),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    async function check() {
      try {
        const response = await authFetch(
            "/api/merchant/access",
            { signal: c.signal },
            owner,
          ),
          result = await response.json();
        if (c.signal.aborted || useAuth.getState().user?.id !== owner) return;
        if (response.status === 403) {
          setAccess(null);
          setLoaded(true);
          return;
        }
        if (!response.ok) throw new Error(result.error ?? "Эрх шалгасангүй.");
        setAccess(result);
        setLoaded(true);
        setError("");
      } catch (e) {
        if (!c.signal.aborted)
          setError(e instanceof Error ? e.message : "Эрх шалгасангүй.");
      }
    }
    void check();
    const interval = setInterval(() => {
      void check();
    }, 30000);
    return () => {
      c.abort();
      clearInterval(interval);
    };
  }, [owner]);
  if (error)
    return (
      <main id="main-content" className="ui-page">
        <p role="alert">{error}</p>
        <button className="btn-ghost" onClick={() => window.location.reload()}>
          Дахин шалгах
        </button>
      </main>
    );
  if (!loaded)
    return (
      <PageSkeleton layout="status" label="Ажилтны эрхийг шалгаж байна…" />
    );
  if (!access || access.role === "owner") return fallback;
  return (
    <TeamContent
      key={`${owner}:${access.role}`}
      owner={owner}
      userName={userName}
      access={access}
    />
  );
}
function TeamContent({
  owner,
  userName,
  access,
}: {
  owner: string;
  userName: string;
  access: WorkspaceAccess;
}) {
  const allowed: MerchantTab[] =
    access.role === "driver"
      ? ["delivery"]
      : access.role === "warehouse"
        ? ["delivery", "branches"]
        : ["orders", "reviews", "returns"];
  const [tab, setTab] = useState<MerchantTab>(allowed[0]);
  useEffect(() => {
    const sync = () => {
      const next = readMerchantLocation(window.location.search).tab;
      setTab(allowed.includes(next) ? next : allowed[0]);
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
    // Role changes remount this workspace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access.role]);
  return (
    <MerchantShell
      active={tab}
      onChange={(next) => {
        if (allowed.includes(next)) {
          setTab(next);
          window.history.pushState(
            null,
            "",
            merchantLocationPath("/merchant", "", "", next),
          );
        }
      }}
      userName={userName}
      storeName={access.storeName}
      owner={owner}
      hasStore
      allowedTabs={allowed}
      onOpenKitchen={() => {}}
    >
      {tab === "delivery" &&
        (access.role === "driver" || access.role === "warehouse") && (
          <MerchantDeliveryBoard owner={owner} staffRole={access.role} />
        )}
      {tab === "branches" && <MerchantBranches owner={owner} staff />}
      {tab === "reviews" && <MerchantFeedback owner={owner} />}
      {tab === "returns" && <MerchantFeedback owner={owner} cases />}
      {tab === "orders" && <TeamOrders owner={owner} />}
    </MerchantShell>
  );
}
function TeamOrders({ owner }: { owner: string }) {
  const [page, setPage] = useState(0);
  const r = useOperations<{
    orders: {
      id: string;
      delivery: { name: string; phone: string; address: string };
      items: { name: string; qty: number }[];
      status: string;
      orderStatus?: string;
      cancellationStatus?: string;
    }[];
    hasMore: boolean;
  }>(owner, "orders", `&page=${page}`);
  return (
    <section className="merchant-ops">
      <h1>Захиалгууд</h1>
      {r.error && <p role="alert">{r.error}</p>}
      <button className="btn-ghost" onClick={r.reload}>
        Шинэчлэх
      </button>
      {!r.data && !r.error ? (
        <PageSkeleton compact variant="dashboard" />
      ) : (
        r.data?.orders.map((o) => (
          <article className="ops-card" key={o.id}>
            <h2>
              #{o.id.slice(0, 8)} · {o.delivery.name}
            </h2>
            <p>
              {o.orderStatus === "cancelled" ? "Цуцлагдсан" : o.status}{" "}
              {o.cancellationStatus === "requested" && "· Цуцлах хүсэлттэй"}
            </p>
            <p>{o.items.map((i) => `${i.name} × ${i.qty}`).join(" · ")}</p>
            <a href={`tel:${o.delivery.phone.replace(/[^+\d]/g, "")}`}>
              {o.delivery.phone}
            </a>
            <p>{o.delivery.address}</p>
          </article>
        ))
      )}
      {r.data?.orders.length === 0 && <p>Захиалга алга.</p>}
      <div className="ops-pager">
        <button
          className="btn-ghost"
          disabled={!page}
          onClick={() => setPage(page - 1)}
        >
          Өмнөх
        </button>
        <span>{page + 1}</span>
        <button
          className="btn-ghost"
          disabled={!r.data?.hasMore}
          onClick={() => setPage(page + 1)}
        >
          Дараах
        </button>
      </div>
    </section>
  );
}
