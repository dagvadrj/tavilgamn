"use client";

import { useEffect, useState } from "react";
import { Search, Users, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@/store/auth";

type UserRow = {
  id: string;
  name: string;
  email: string | null;
  orders: number;
  joined: string;
  role: "customer" | "merchant" | "admin";
  store: { id: string; name: string; storeType: string } | null;
};

type Result = {
  users: UserRow[];
  page: number;
  hasMore: boolean;
};

export function AdminUsers() {
  const userId = useAuth((state) => state.user?.id);
  const role = useAuth((state) => state.role);

  if (!userId || role !== "admin") return null;

  return <UserList key={userId} owner={userId} />;
}

function UserList({ owner }: { owner: string }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setLoading(true);
    setError(null);
    setResult(null);

    async function load() {
      try {
        const response = await authFetch(
          `/api/admin/users?page=${page}`,
          { signal: controller.signal },
          owner,
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Хэрэглэгчдийг ачаалж чадсангүй.");
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

    return () => {
      active = false;
      controller.abort();
    };
  }, [owner, page, refresh]);

  const current = result?.page === page ? result : null;


  const visible = current?.users.filter(user => (user.name + " " + (user.email ?? "")).toLowerCase().includes(query.trim().toLowerCase())) ?? [];
  return <div>
    <div className="admin-page-heading"><div><span className="admin-eyebrow">ХЭРЭГЛЭГЧИЙН БҮРТГЭЛ</span><h1>Хэрэглэгчид</h1><p>Хэрэглэгчийн эрх, дэлгүүр болон захиалгын мэдээлэл.</p></div><span className="admin-heading-icon"><Users size={25} strokeWidth={1.5} /></span></div>
    <div className="admin-toolbar"><label className="admin-search"><Search size={18} /><input aria-label="Энэ хуудсан дахь хэрэглэгч хайх" placeholder="Энэ хуудсанд нэр, имэйлээр хайх…" value={query} onChange={e => setQuery(e.target.value)} /></label><button type="button" className="btn-ghost" disabled={loading} onClick={() => setRefresh(v => v + 1)}><RefreshCw size={15} />Шинэчлэх</button></div>
    {loading ? <div className="admin-loading" role="status"><Users size={24} />Хэрэглэгчдийг ачаалж байна…</div> : error ? <p className="admin-error" role="alert">{error}</p> : !visible.length ? <div className="admin-empty"><Users size={30} /><strong>{query ? "Хэрэглэгч олдсонгүй" : "Энэ хуудсанд хэрэглэгч алга"}</strong><p>{query ? "Нэр, имэйлээ өөрчлөх эсвэл өөр хуудас сонгоорой." : "Шинэ бүртгэлүүд энд харагдана."}</p></div> : <>
      <p className="admin-result-count">{visible.length} хэрэглэгч · Энэ хуудсанд · Захиалгын бүх төлөв багтсан</p>
      <div className="admin-panel"><table className="admin-data-table admin-user-table"><thead><tr><th scope="col">Хэрэглэгч</th><th scope="col">Имэйл хаяг</th><th scope="col">Эрх / Дэлгүүр</th><th scope="col">Захиалга</th><th scope="col">Бүртгүүлсэн</th></tr></thead><tbody>{visible.map(user => <tr key={user.id}><td data-label="Хэрэглэгч"><div className="admin-product-name"><span className="admin-avatar">{user.name.slice(0,1).toUpperCase()}</span><strong>{user.name}</strong></div></td><td data-label="Имэйл">{user.email ?? "Имэйл бүртгээгүй"}</td><td data-label="Эрх / Дэлгүүр"><UserRoleEditor key={`${user.id}-${user.role}`} owner={owner} user={user} onSaved={(role) => setResult(current => current && ({ ...current, users: current.users.map(item => item.id === user.id ? { ...item, role } : item) }))} /></td><td data-label="Захиалга"><span className="admin-status">{user.orders} захиалга</span></td><td data-label="Бүртгүүлсэн">{new Date(user.joined).toLocaleDateString("mn-MN", {timeZone:"Asia/Ulaanbaatar"})}</td></tr>)}</tbody></table></div>
    </>}
    <nav className="admin-pagination" aria-label="Хэрэглэгчдийн хуудаслалт"><span aria-live="polite">Хуудас {page}</span><button type="button" disabled={loading || page === 1} onClick={() => {setPage(v => v - 1); setQuery("");}}><ChevronLeft size={14} />Өмнөх</button><button type="button" disabled={loading || !!error || !current?.hasMore} onClick={() => {setPage(v => v + 1); setQuery("");}}>Дараах<ChevronRight size={14} /></button></nav>
  </div>;
}

function UserRoleEditor({ owner, user, onSaved }: { owner: string; user: UserRow; onSaved: (role: "customer" | "merchant") => void }) {
  const [role, setRole] = useState(user.role);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (user.role === "admin") return <span className="admin-status">Администратор</span>;
  return <div className="min-w-40 space-y-2">
    <select className="input !py-2 !text-xs" aria-label={`${user.name} хэрэглэгчийн эрх`} disabled={busy} value={role} onChange={event => { setRole(event.target.value as "customer" | "merchant"); setError(null); }}><option value="customer">Хэрэглэгч</option><option value="merchant">Merchant · Худалдаа эрхлэгч</option></select>
    {user.store && <p className="text-xs text-[#737D6C]">{user.store.name}</p>}
    {role !== user.role && <button type="button" className="btn-ghost !min-h-9 !px-3 !py-2 !text-xs" disabled={busy} onClick={async () => {
      if (busy || role === "admin") return;
      setBusy(true); setError(null);
      try {
        const response = await authFetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: user.id, role }) }, owner);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Эрхийг өөрчилж чадсангүй.");
        if (useAuth.getState().user?.id === owner && useAuth.getState().role === "admin") onSaved(role);
      } catch (reason) { setError(reason instanceof Error ? reason.message : "Эрхийг өөрчилж чадсангүй."); }
      finally { setBusy(false); }
    }}>{busy ? "Хадгалж байна…" : "Эрх хадгалах"}</button>}
    {error && <p className="text-xs text-red-700" role="alert">{error}</p>}
  </div>;
}

