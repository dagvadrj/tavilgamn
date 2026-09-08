"use client";
import { useEffect, useState } from "react";
import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@/store/auth";

type Message = { id: string; name: string; email: string; message: string; created_at: string };
export function AdminMessages() {
  const owner = useAuth(s => s.user?.id);
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{owner: string; messages: Message[]; hasMore: boolean} | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!owner) return;
    let active = true;
    setBusy(true); setError("");
    void (async () => {
      try {
        const response = await authFetch(`/api/admin/messages?page=${page}`, {}, owner);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (active) setResult({owner, ...data});
      } catch { if (active) setError("Зурвасуудыг ачаалж чадсангүй. Дахин оролдоно уу."); }
      finally { if (active) setBusy(false); }
    })();
    return () => { active = false; };
  }, [owner, page, refresh]);
  const current = result?.owner === owner ? result : null;
  return <div>
    <div className="admin-page-heading"><div><h1>Ирсэн зурвасууд</h1><p>Холбоо барих хэсгээр ирүүлсэн хүсэлтүүд.</p></div><button className="btn-ghost" disabled={busy} onClick={() => setRefresh(v => v + 1)}>Шинэчлэх</button></div>
    {error && <p role="alert" className="admin-error">{error}</p>}
    {busy ? <p role="status">Зурвас ачаалж байна…</p> : !error && <div className="space-y-4">
      {!current?.messages.length && <p className="admin-empty">Одоогоор зурвас алга.</p>}
      {current?.messages.map(message => <article key={message.id} className="admin-panel p-5">
        <h2 className="font-semibold">{message.name}</h2><a className="break-all text-sm underline" href={`mailto:${message.email}`}>{message.email}</a>
        <p className="mt-1 text-xs text-[#74806b]">{new Date(message.created_at).toLocaleString("mn-MN", {timeZone: "Asia/Ulaanbaatar"})}</p>
        <p className="mt-4 whitespace-pre-wrap break-words text-sm">{message.message}</p>
      </article>)}
    </div>}
    <nav className="admin-pagination" aria-label="Зурвасын хуудаслалт"><span>{page + 1}</span><button disabled={busy || page === 0} onClick={() => setPage(p => p - 1)}>Өмнөх</button><button disabled={busy || !!error || !current?.hasMore} onClick={() => setPage(p => p + 1)}>Дараах</button></nav>
  </div>;
}
