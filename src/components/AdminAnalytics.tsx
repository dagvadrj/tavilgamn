"use client";

import { useEffect, useState } from "react";
import { RefreshCw, CalendarDays, Wallet, CircleCheck, ShoppingBag, Clock3, Package, type LucideIcon } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@/store/auth";
import { OrderHistory } from "@/components/OrderHistory";

type Analytics = {
  periodStart: string;
  asOf: string;
  ordersCreated: string;
  paymentsReceived: string;
  grossReceived: string;
  pendingOrders: string;
};

const dateLabel = (date: string) =>
  new Date(date).toLocaleString("mn-MN", {
    timeZone: "Asia/Ulaanbaatar",
  });

const countLabel = (value: string) => BigInt(value).toLocaleString("mn-MN");

export function AdminAnalytics() {
  const userId = useAuth((state) => state.user?.id);
  const role = useAuth((state) => state.role);

  if (!userId || role !== "admin") return null;

  return <AnalyticsPanel key={userId} owner={userId} />;
}

function AnalyticsPanel({ owner }: { owner: string }) {
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    setLoading(true);
    setError(null);
    setResult(null);

    async function load() {
      try {
        const response = await authFetch(
          "/api/admin/analytics",
          { signal: controller.signal },
          owner,
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Аналитик ачаалсангүй.");
        }

        if (
          active &&
          useAuth.getState().user?.id === owner &&
          useAuth.getState().role === "admin"
        ) {
          setResult(data);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Алдаа гарлаа.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; controller.abort(); };
  }, [owner, refresh]);

  return <div>
    <div className="admin-page-heading"><div><span className="admin-eyebrow">ТАНЫ ДЭЛГҮҮР ӨНӨӨДӨР</span><h1>Ерөнхий тойм</h1><p>Сүүлийн 30 хоногийн захиалга, хүлээн авсан төлбөр.</p></div><button type="button" className="btn-ghost" disabled={loading} onClick={() => setRefresh(v => v + 1)}><RefreshCw size={15} />Шинэчлэх</button></div>
    {loading ? <div className="admin-loading" role="status"><RefreshCw size={22} /><p>Тойм мэдээллийг ачаалж байна…</p></div> : error ? <p role="alert" className="admin-error">{error}</p> : result && <>
      <div className="admin-date-range"><CalendarDays size={15} /><span>{dateLabel(result.periodStart)} — {dateLabel(result.asOf)}</span><span>· Улаанбаатарын цагаар</span></div>
      <div className="admin-metrics">
        <Metric icon={Wallet} label="Хүлээн авсан төлбөр" value={countLabel(result.grossReceived) + " ₮"} detail="30 хоног · Хүргэлтийн төлбөр багтсан" />
        <Metric icon={CircleCheck} label="Төлбөр баталгаажсан" value={countLabel(result.paymentsReceived)} detail="30 хоногт баталгаажсан захиалга" />
        <Metric icon={ShoppingBag} label="Шинэ захиалга" value={countLabel(result.ordersCreated)} detail="30 хоног · Бүх төлөв" />
        <Metric icon={Clock3} label="Төлбөр хүлээж буй" value={countLabel(result.pendingOrders)} detail="Одоогийн нийт · Бүх хугацаа" />
      </div>
      <p className="admin-note">Хүлээн авсан төлбөрийг баталгаажсан огноогоор тооцно. Буцаалт, шимтгэл, зардлыг хасаагүй дүн.</p>
    </>}
    <section className="mt-8"><div className="admin-panel-heading rounded-t-2xl border border-[#e3e7dc] bg-white"><div><h2>Захиалгын мэдээлэл</h2><p>Төлөв болон төлбөрийн мэдээллийг нэг дороос.</p></div><Package size={21} className="text-[#8b9c79]" /></div><OrderHistory admin /></section>
  </div>;
}

function Metric({icon: Icon, label, value, detail}: {icon: LucideIcon; label: string; value: string; detail: string}) {
  return <div className="admin-metric"><div className="admin-metric-top"><span>{label}</span><Icon size={21} strokeWidth={1.6} /></div><strong>{value}</strong><p>{detail}</p></div>;
}

