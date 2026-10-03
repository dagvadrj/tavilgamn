"use client";
import { useEffect, useRef, useState } from "react";
import type { ProjectVersionSummary } from "@/lib/roomProjects";
export function ProjectVersionHistory<T>({ id, revision, disabled, loadVersions, loadVersion, onRestore, onBusyChange }: {
  id: string; revision: number; disabled: boolean;
  loadVersions: (id: string, before?: number) => Promise<ProjectVersionSummary[]>;
  loadVersion: (id: string, revision: number) => Promise<T>;
  onRestore: (version: T) => void; onBusyChange: (busy: boolean) => void;
}) {
  const [open, setOpen] = useState(false), [items, setItems] = useState<ProjectVersionSummary[]>([]),
    [loading, setLoading] = useState(false), [error, setError] = useState("");
  const generation = useRef(0), pending = useRef(false);
  useEffect(() => { onBusyChange(loading); return () => onBusyChange(false); }, [loading, onBusyChange]);
  useEffect(() => { generation.current++; pending.current = false; setItems([]); setOpen(false); setLoading(false); setError(""); }, [id, revision]);
  useEffect(() => () => { generation.current++; }, []);
  async function load(more = false) {
    if (pending.current || disabled) return;
    const epoch = ++generation.current; pending.current = true; setLoading(true); setError(""); setOpen(true);
    try { const list = await loadVersions(id, more ? items.at(-1)?.revision : undefined);
      if (epoch === generation.current) setItems(current => more ? [...current, ...list] : list);
    } catch (e) { if (epoch === generation.current) setError(e instanceof Error ? e.message : "Түүх ачаалагдсангүй."); }
    finally { if (epoch === generation.current) { pending.current = false; setLoading(false); } }
  }
  async function restore(target: number) {
    if (pending.current || disabled) return;
    const epoch = ++generation.current; pending.current = true; setLoading(true); setError("");
    try { const version = await loadVersion(id, target); if (epoch === generation.current) onRestore(version); }
    catch (e) { if (epoch === generation.current) setError(e instanceof Error ? e.message : "Хувилбар ачаалагдсангүй."); }
    finally { if (epoch === generation.current) { pending.current = false; setLoading(false); } }
  }
  return <section className="km-version-history" aria-label="Загварын хувилбарын түүх">
    <button type="button" disabled={disabled || loading} aria-expanded={open} onClick={() => open ? setOpen(false) : void load()}>Хувилбарын түүх · v{revision}</button>
    {open && <>
      <p>Хувилбар editor-д ачаална. Хадгалах үед шинэ хувилбар болно; хуучин түүх арилахгүй. Дуусаагүй өөрчлөлтөө хадгалах эсвэл undo-оор буцааж болно.</p>
      {items.map(item => <div key={item.revision}><span>v{item.revision} · {item.name} · {new Date(item.created_at).toLocaleString("mn-MN")}</span>
        <button type="button" disabled={disabled || loading} onClick={() => void restore(item.revision)}>v{item.revision} сэргээх</button></div>)}
      {items.length > 0 && items.length % 30 === 0 && <button type="button" disabled={loading} onClick={() => void load(true)}>Өмнөх хувилбарууд</button>}
    </>}
    {loading && <p role="status">Хувилбар ачаалж байна…</p>}{error && <p role="alert">{error}</p>}
  </section>;
}
