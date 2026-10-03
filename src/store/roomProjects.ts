"use client";
import { create } from "zustand";
import { plannerProjectRequest, ProjectRequestError } from "@/lib/plannerProjectRequest";
import { parseRoomProject, roomSignature, type RoomProjectDocument } from "@/lib/roomProjectValidation";
import { readRoomProject, readRoomSummary, type RoomProject, type RoomProjectSummary, type ProjectVersionSummary } from "@/lib/roomProjects";
type State = { owner: string | null; items: RoomProjectSummary[]; loading: boolean; loaded: boolean; error: string; errorStatus: number; cursor: string | null;
  refresh: (more?: boolean, archived?: boolean) => Promise<void>;
  load: (id: string) => Promise<RoomProject>;
  save: (id: string, name: string, document: RoomProjectDocument, revision: number, importKey?: string, forceVersion?: boolean) => Promise<RoomProject | null>;
  archive: (id: string, revision: number, archived: boolean) => Promise<boolean>;
  versions: (id: string, before?: number) => Promise<ProjectVersionSummary[]>;
  version: (id: string, revision: number) => Promise<{ name: string; document: RoomProjectDocument }> };
let generation = 0, listRequest = 0;
// A failed transport may have committed. Retry the same snapshot with its key.
const operations = new Map<string, { id: string; document: RoomProjectDocument }>();
const saves = new Map<string, Promise<RoomProject | null>>();
const message = (error: unknown) => error instanceof Error ? error.message : "Cloud үйлчилгээ холбогдсонгүй.";
const status = (error: unknown) => error instanceof ProjectRequestError ? error.status : 0;
export const useRoomProjects = create<State>((set, get) => ({
  owner: null, items: [], loading: false, loaded: false, error: "", errorStatus: 0, cursor: null,
  refresh: async (more = false, archived = false) => {
    const owner = get().owner, epoch = generation; if (!owner || get().loading) return;
    const requestId = ++listRequest, cursor = more ? get().cursor : null;
    if (more && !cursor) return;
    set({ loading: true, error: "", errorStatus: 0 });
    try {
      const query = new URLSearchParams(); if (cursor) query.set("cursor", cursor); if (archived) query.set("archived", "1");
      const body = await plannerProjectRequest(owner, `/api/room-projects?${query}`);
      if (epoch !== generation || requestId !== listRequest) return;
      const next: RoomProjectSummary[] = body.projects.map(readRoomSummary);
      set({ items: more ? [...get().items, ...next.filter(p => !get().items.some(existing => existing.id === p.id))] : next,
        cursor: body.nextCursor, loaded: true, loading: false });
    } catch (e) { if (epoch === generation && requestId === listRequest) set({ loading: false, error: message(e), errorStatus: status(e) }); }
  },
  load: async id => {
    const owner = get().owner, epoch = generation; if (!owner) throw new ProjectRequestError("Нэвтэрнэ үү.", 401);
    const body = await plannerProjectRequest(owner, `/api/room-projects/${encodeURIComponent(id)}`);
    if (epoch !== generation) throw new ProjectRequestError("Хэрэглэгч өөрчлөгдсөн.", 401);
    return readRoomProject(body.project);
  },
  save: (id, name, document, revision, importKey, forceVersion = false) => {
    const owner = get().owner, epoch = generation;
    if (!owner) { set({ error: "Хадгалахын тулд нэвтэрнэ үү.", errorStatus: 401 }); return Promise.resolve(null); }
    const key = JSON.stringify([owner, id, revision, name, roomSignature(document), importKey, forceVersion]);
    const pending = saves.get(key); if (pending) return pending;
    if (!operations.has(key)) {
      if (operations.size >= 30) operations.delete(operations.keys().next().value!);
      operations.set(key, { id: crypto.randomUUID(), document: structuredClone(document) });
    }
    const operation = operations.get(key)!;
    ++listRequest; set({ error: "", errorStatus: 0, loading: false });
    const promise = (async () => {
      try {
        const body = await plannerProjectRequest(owner, "/api/room-projects", { method: "PUT", body: JSON.stringify({ id, name, document: operation.document,
          expectedRevision: revision, operationId: operation.id, importKey, forceVersion }) });
        const project = readRoomProject(body.project);
        if (epoch !== generation) return null;
        if (project.archivedAt) throw new ProjectRequestError("Импортолсон загвар архивт байна. Account дахь архиваас сэргээнэ үү.", 409);
        operations.delete(key); ++listRequest;
        set({ items: [project, ...get().items.filter(p => p.id !== project.id)], loading: false });
        return project;
      } catch (e) { if (epoch === generation) set({ error: message(e), errorStatus: status(e) }); return null; }
      finally { saves.delete(key); }
    })();
    saves.set(key, promise); return promise;
  },
  archive: async (id, revision, archived) => {
    const owner = get().owner, epoch = generation; if (!owner) return false;
    ++listRequest; set({ error: "", errorStatus: 0, loading: false });
    try {
      await plannerProjectRequest(owner, `/api/room-projects/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ archived, expectedRevision: revision }) });
      if (epoch !== generation) return false;
      ++listRequest; set({ items: get().items.filter(p => p.id !== id), loading: false }); return true;
    } catch (e) { if (epoch === generation) set({ error: message(e), errorStatus: status(e) }); return false; }
  },
  versions: async (id, before) => {
    const owner = get().owner, epoch = generation; if (!owner) throw new ProjectRequestError("Нэвтэрнэ үү.", 401);
    const body = await plannerProjectRequest(owner, `/api/room-projects/${encodeURIComponent(id)}/versions${before ? `?before=${before}` : ""}`);
    if (epoch !== generation) throw new ProjectRequestError("Хэрэглэгч өөрчлөгдсөн.", 401);
    return body.versions;
  },
  version: async (id, revision) => {
    const owner = get().owner, epoch = generation; if (!owner) throw new ProjectRequestError("Нэвтэрнэ үү.", 401);
    const body = await plannerProjectRequest(owner, `/api/room-projects/${encodeURIComponent(id)}/versions?revision=${revision}`);
    if (epoch !== generation) throw new ProjectRequestError("Хэрэглэгч өөрчлөгдсөн.", 401);
    return { name: body.version.name, document: parseRoomProject(body.version.document) };
  },
}));
export function setRoomProjectOwner(owner: string | null) {
  if (useRoomProjects.getState().owner === owner) return;
  generation++; listRequest++; operations.clear(); saves.clear();
  useRoomProjects.setState({ owner, items: [], loading: false, loaded: false, error: "", errorStatus: 0, cursor: null });
}
export { roomSignature };
