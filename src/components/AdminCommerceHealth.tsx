"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@/store/auth";
import { formatDateTime } from "@/lib/format";

type Health = { cancellationRequests: number; paymentReviews: number; unsettledMedia: number; retainedMedia: number; checkedAt: string };
export function AdminCommerceHealth({ owner }: { owner: string }) {
  const [data, setData] = useState<Health | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true); setError(null); setData(null);
    void (async () => {
      try {
        const response = await authFetch("/api/admin/commerce", { signal: controller.signal }, owner);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Хяналтын мэдээлэл ачаалсангүй.");
        if (active && useAuth.getState().user?.id === owner && useAuth.getState().role === "admin") setData(result);
      } catch (issue) { if (active) setError(issue instanceof Error ? issue.message : "Хяналтын мэдээлэл ачаалсангүй."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; controller.abort(); };
  }, [owner, refresh]);
  return <section className="mb-6 rounded-2xl border border-[#293C32]/15 bg-[#F8F7F3] p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">Худалдааны хяналт</h2><button className="btn-ghost" type="button" disabled={loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={14} />Шалгах</button></div>
    {loading ? <p role="status" className="mt-3 text-sm text-[#6C726B]">Мэдээлэл ачаалж байна…</p> : error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : data && <><dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Цуцлах хүсэлт", data.cancellationRequests], ["Төлбөр тулгах", data.paymentReviews], ["24 цагаас хуучин холбогдоогүй зураг", data.unsettledMedia], ["Түүхэнд хадгалсан зураг", data.retainedMedia]].map(([label, value]) => <div className="rounded-xl border border-[#293C32]/10 bg-white p-3" key={label}><dt className="text-xs leading-relaxed text-[#6C726B]">{label}</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">{value}</dd></div>)}</dl><p className="mt-3 text-xs text-[#6C726B]">{formatDateTime(data.checkedAt)} · Автомат цуцлалт, мөнгөний шилжүүлэг эсвэл зураг устгал хийхгүй. Хуучин болон холбогдоогүй зургийг ledger-ийн public_id-тай тулгаж шалгана.</p></>}
  </section>;
}
