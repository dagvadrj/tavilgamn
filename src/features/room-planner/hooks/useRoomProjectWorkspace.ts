"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/store/auth";
import { useDesigns } from "@/store/designs";
import { useRoomProjects } from "@/store/roomProjects";
import { roomDocument, roomSignature, UUID_PATTERN, type RoomProjectDocument } from "@/lib/roomProjectValidation";
import type { ProjectSaveState } from "@/features/planner/components/ProjectSaveStatus";
import { roomStorageError } from "@/lib/roomLocalStorage";
export function useRoomProjectWorkspace() {
  const user = useAuth(s => s.user), initialized = useAuth(s => s.initialized);
  const initialize = useAuth(s => s.initialize);
  useEffect(() => { void initialize(); }, [initialize]);
  const current = useDesigns(s => s.current), links = useDesigns(s => s.cloudLinks), owner = useDesigns(s => s.owner);
  const params = useSearchParams(), projectId = params.get("project");
  const [saving, setSaving] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState(""),
    [failure, setFailure] = useState<ProjectSaveState | null>(null), [message, setMessage] = useState("");
  const generation = useRef(0), pending = useRef<Promise<boolean> | null>(null), forceVersion = useRef(false), loaded = useRef("");
  const [storageError, setStorageError] = useState("");
  useEffect(() => {
    const key = `casa-designs-${owner ?? "guest"}`, update = () => setStorageError(roomStorageError(key));
    update(); window.addEventListener("room-storage-status", update);
    return () => window.removeEventListener("room-storage-status", update);
  }, [owner]);
  useEffect(() => { const epochs = generation; epochs.current++; loaded.current = ""; pending.current = null; forceVersion.current = false;
    setSaving(false); setLoading(false); setError(""); setFailure(null); setMessage("");
    return () => { epochs.current++; };
  }, [user?.id]);
  useEffect(() => { forceVersion.current = false; setError(""); setFailure(null); setMessage(""); }, [current?.id]);
  const link = current ? links[current.id] : undefined;
  const signature = useMemo(() => { try { return current ? roomSignature(roomDocument(current)) : ""; } catch {
     return "invalid"; } }, [current]);
  const state: ProjectSaveState = 
  saving ? "saving" : failure ?? (!user ? "local" : link?.signature === signature && !forceVersion.current ? "saved" : "dirty");
  const reload = useCallback(async () => {
    const local = useDesigns.getState(), target = local.current ? local.cloudLinks[local.current.id]?.id : projectId;
    if (!target || !user || owner !== user.id) return;
    const epoch = generation.current; setLoading(true); setError("");
    try { const project = await useRoomProjects.getState().load(target);
      if (epoch !== generation.current) return;
      useDesigns.getState().openCloud(project); forceVersion.current = false; setFailure(null); setMessage("Сүүлийн cloud загвар нээгдлээ. Өмнөх draft энэ төхөөрөмжид үлдсэн.");
    } catch (e) { if (epoch === generation.current) setError(e instanceof Error ? e.message : "Загвар нээгдсэнгүй."); }
    finally { if (epoch === generation.current) setLoading(false); }
  }, [projectId, user, owner]);
  useEffect(() => {
    if (!projectId || !initialized) return;
    if (!UUID_PATTERN.test(projectId)) { setError("Project ID буруу байна."); return; }
    if (!user) { setError("Cloud өрөөний загвар нээхийн тулд нэвтэрнэ үү."); return; }
    if (owner !== user.id) return;
    const key = `${user.id}:${projectId}`; if (loaded.current === key) return; loaded.current = key;
    const local = useDesigns.getState();
    // A recovered unsaved draft is authoritative until the user reloads it.
    if (local.current && local.cloudLinks[local.current.id]?.id === projectId) return;
    const epoch = generation.current; setLoading(true); setError("");
    void useRoomProjects.getState().load(projectId).then(project => {
      if (epoch === generation.current) useDesigns.getState().openCloud(project);
    }).catch(e => { if (epoch === generation.current) setError(e instanceof Error ? e.message : "Загвар нээгдсэнгүй."); })
      .finally(() => { if (epoch === generation.current) setLoading(false); });
  }, [projectId, initialized, user, owner]);
  const save = useCallback((name?: string, copy = false): Promise<boolean> => {
    if (pending.current) return pending.current;
    const local = useDesigns.getState(); if (!local.current) return Promise.resolve(false);
    local.endEdit(); local.saveCurrent(name?.trim() || local.current.name);
    if (!user || owner !== user.id) {
      const issue = roomStorageError(`casa-designs-${owner ?? "guest"}`);
      setMessage(issue || "Загвар энэ төхөөрөмжид хадгалагдлаа. Cloud хадгалалт нэвтэрсний дараа боломжтой."); return Promise.resolve(!issue);
    }
    let document: RoomProjectDocument;
    try { document = roomDocument(useDesigns.getState().current!); }
    catch (e) { setError(e instanceof Error ? e.message : "Загварын өгөгдөл буруу байна."); setFailure("error"); return Promise.resolve(false); }
    if (copy) { document.design.id = `d_${crypto.randomUUID()}`; document.design.name = `${document.design.name.slice(0, 88)} (хуулбар)`; }
    const localId = document.design.id, target = useDesigns.getState().prepareCloudSave(localId), epoch = generation.current;
    setSaving(true); setError(""); setFailure(null);
    const promise = (async () => {
      try {
        const result = await useRoomProjects.getState().save(target.id, document.design.name, document, target.revision,
          target.revision === 0 ? `browser:${localId}` : undefined, forceVersion.current && !copy);
        if (epoch !== generation.current) return false;
        if (!result) { const store = useRoomProjects.getState(); setError(store.error);
          setFailure(store.errorStatus === 409 ? "conflict" : navigator.onLine === false ? "offline" : "error"); return false; }
        if (copy) useDesigns.getState().openCloud(result); else useDesigns.getState().recordCloudSave(localId, result);
        forceVersion.current = false; setMessage("Cloud загвар хадгалагдлаа.");
        if (useDesigns.getState().current?.id === localId) {
          const url = new URL(window.location.href); url.searchParams.set("project", result.id);
          window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
        }
        return true;
      } finally { if (epoch === generation.current) { setSaving(false); pending.current = null; } }
    })();
    pending.current = promise; return promise;
  }, [user, owner]);
  const restore = useCallback((version: { name: string; document: RoomProjectDocument }) => {
    const local = useDesigns.getState(); if (!local.current) return;
    local.saveCurrent(); local.replaceCurrent({ ...version.document.design, id: local.current.id, name: version.name });
    forceVersion.current = true; setError(""); setFailure(null); setMessage("Өмнөх хувилбар editor-д ачааллаа. Хадгалахад шинэ хувилбар үүснэ.");
  }, []);
  return { save, reload, restore, state, revision: link?.revision ?? 0, cloudId: link?.id, saving, loading, error, message, user, storageError,
    loginNext: `/planner${params.size ? `?${params}` : ""}` };
}
