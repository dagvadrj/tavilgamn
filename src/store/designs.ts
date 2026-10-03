"use client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { RoomDesign, RoomSize, PlacedFurniture, RoomType } from "@/lib/types";
import { activateDesignRoom, DEFAULT_FLOOR_MATERIAL, LEGACY_FLOOR_MATERIAL, newDesignRoom, syncDesignRooms } from "@/lib/roomDesign";
import { ROOM_TYPES } from "@/lib/roomGeometry";
import { parseRoomDesign, roomDocument, roomSignature } from "@/lib/roomProjectValidation";
import type { RoomProject } from "@/lib/roomProjects";
import { readRoomLocalState, roomStorage } from "@/lib/roomLocalStorage";

export const ROOM_DIMENSIONS: Record<RoomSize, { w: number; d: number }> = {
  "40": { w: 6.3, d: 6.3 },
  "80": { w: 8.9, d: 8.9 },
  "120": { w: 11, d: 11 },
};

interface DesignState {
  owner: string | null;
  cloudLinks: Record<string, { id: string; revision: number; signature: string }>;
  openCloud: (project: RoomProject) => void;
  recordCloudSave: (localId: string, project: RoomProject) => void;
  prepareCloudSave: (localId: string) => { id: string; revision: number; signature: string };
  replaceCurrent: (design: RoomDesign) => void;
  designs: RoomDesign[];
  /** the design currently being edited */
  current: RoomDesign | null;
  past: RoomDesign[];
  future: RoomDesign[];
  transaction: RoomDesign | null;
  beginEdit: () => void;
  endEdit: () => void;
  undo: () => void;
  redo: () => void;
  createNew: (size: RoomSize, name?: string, roomType?: RoomType) => void;
  addRoom: (type: RoomType) => void;
  selectRoom: (id: string) => void;
  loadDesign: (id: string) => void;
  saveCurrent: (name?: string) => void;
  deleteDesign: (id: string) => void;
  duplicateDesign: (id: string) => void;
  updatePieces: (pieces: PlacedFurniture[]) => void;
  updateRoom: (patch: Partial<Pick<RoomDesign, "wallColor" | "floorColor" | "name" | "width" | "depth" | "size" | "height" | "wallFeatures" | "columns" | "roomName" | "roomType" | "openings" | "floorMaterial" | "wallMaterials" | "ceilingMaterial" | "lighting" | "pieces">>) => void;
}
const createDesignId = () => `d_${crypto.randomUUID()}`;

const cloneDesign = syncDesignRooms;
  
const blankDesign = (size: RoomSize, name = "Untitled Room", roomType?: RoomType): RoomDesign => {
  const dims = ROOM_DIMENSIONS[size];
  return cloneDesign({
    id: createDesignId(),
    name,
    size,
    width: roomType ? ROOM_TYPES[roomType].width : dims.w,
    depth: roomType ? ROOM_TYPES[roomType].depth : dims.d,
    roomType: roomType ?? "living",
    wallColor: "#EFE6D6",
    floorColor: "#C9A37A",
    floorMaterial: DEFAULT_FLOOR_MATERIAL,
    pieces: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
};

export const useDesigns = create<DesignState>()(
  persist(
    (set, get) => ({
      owner: null, cloudLinks: {},
      prepareCloudSave: localId => {
        const existing = get().cloudLinks[localId]; if (existing) return existing;
        const link = { id: crypto.randomUUID(), revision: 0, signature: "" };
        set({ cloudLinks: { ...get().cloudLinks, [localId]: link } }); return link;
      },
      replaceCurrent: design => {
        get().endEdit(); const current = get().current;
        set({ current: cloneDesign(design), past: current ? [...get().past, cloneDesign(current)].slice(-60) : [], future: [], transaction: null });
      },
      openCloud: project => {
        const previous = get().current, link = previous ? get().cloudLinks[previous.id] : undefined;
        let dirty = false;
        if (previous && link) {
          try { dirty = roomSignature(roomDocument(previous)) !== link.signature; } catch { dirty = true; }
        }
        if (get().current) get().saveCurrent();
        const next = parseRoomDesign({ ...project.document.design, name: project.name });
        if (previous && dirty && previous.id === next.id) {
          // A later save of the reopened project must not replace this recovery copy.
          set({ designs: get().designs.map(design => design.id === previous.id
            ? { ...design, id: createDesignId(), name: `${design.name.slice(0, 84)} (local draft)` } : design) });
        }
        set({ current: next, past: [], future: [], transaction: null,
          cloudLinks: { ...get().cloudLinks, [next.id]: { id: project.id, revision: project.revision, signature: roomSignature(project.document) } } });
      },
      recordCloudSave: (localId, project) => set({ cloudLinks: { ...get().cloudLinks,
        [localId]: { id: project.id, revision: project.revision, signature: roomSignature(project.document) } } }),
      designs: [],
      current: null,
      past: [],
      future: [],
      transaction: null,
      beginEdit: () => {
        const { current, transaction } = get();
        if (current && !transaction) set({ transaction: cloneDesign(current) });
      },
      endEdit: () => {
        const { transaction, current, past } = get();
        if (!transaction) return;
        const changed = current && JSON.stringify(current) !== JSON.stringify(transaction);
        set({ transaction: null, ...(changed ? { past: [...past, transaction].slice(-60), future: [] } : {}) });
      },
      undo: () => {
        get().endEdit();
        const { past, current, future } = get();
        if (!current || !past.length) return;
        set({ current: cloneDesign(past[past.length - 1]), past: past.slice(0, -1), future: [cloneDesign(current), ...future].slice(0, 60) });
      },
      redo: () => {
        get().endEdit();
        const { past, current, future } = get();
        if (!current || !future.length) return;
        set({ current: cloneDesign(future[0]), past: [...past, cloneDesign(current)].slice(-60), future: future.slice(1) });
      },
      createNew: (size, name, roomType) => {
        if (get().current) get().saveCurrent();
        set({ current: blankDesign(size, name, roomType), past: [], future: [], transaction: null });
      },
      addRoom: (type) => {
        get().endEdit();
        const current = get().current;
        if (!current) return;
        const synced = cloneDesign(current);
        const room = newDesignRoom(type, synced.rooms!);
        const next = activateDesignRoom({ ...synced, rooms: [...synced.rooms!, room] }, room.id);
        set({ current: { ...next, updatedAt: Date.now() }, past: [...get().past, cloneDesign(current)].slice(-60), future: [] });
      },
      selectRoom: (id) => {
        get().endEdit();
        const current = get().current;
        if (!current || current.activeRoomId === id) return;
        set({ current: activateDesignRoom(current, id) });
      },
      loadDesign: (id) => {
  const design = get().designs.find((item) => item.id === id);

  if (design) {
    set({ current: cloneDesign(design), past: [], future: [], transaction: null });
  }
},
      saveCurrent: (name) => {
  const current = get().current;
  if (!current) return;

  const saved: RoomDesign = cloneDesign({
    ...current,
    name: name ?? current.name,
    updatedAt: Date.now(),
  });

  const existingIndex = get().designs.findIndex(
    (design) => design.id === saved.id,
  );

  const designs =
    existingIndex >= 0
      ? get().designs.map((design, index) =>
          index === existingIndex ? saved : design,
        )
      : [...get().designs, saved];

  set({
    designs,
    current: cloneDesign(saved),
  });
},
      deleteDesign: (id) =>
        set((state) => ({
          designs: state.designs.filter((design) => design.id !== id),
          current: state.current?.id === id ? null : state.current,
          ...(state.current?.id === id ? { past: [], future: [], transaction: null } : {}),
        })),
      duplicateDesign: (id) => {
  const design = get().designs.find((item) => item.id === id);
  if (!design) return;

  const duplicate: RoomDesign = {
    ...cloneDesign(design),
    id: createDesignId(),
    name: `${design.name} (хуулбар)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  set({
    designs: [...get().designs, duplicate],
  });
},
      updatePieces: (pieces) => {
        const c = get().current;
        if (!c) return;
        if (JSON.stringify(c.pieces) === JSON.stringify(pieces)) return;
        set({ current: cloneDesign({ ...c, pieces, updatedAt: Date.now() }),
          ...(!get().transaction ? { past: [...get().past, cloneDesign(c)].slice(-60), future: [] } : {}),
        });
      },
      updateRoom: (patch) => {
        const c = get().current;
        if (!c) return;
        const compatiblePatch = { ...patch };
        // Older integrations edit a single colour; keep that action effective after migration.
        if (patch.wallColor !== undefined && patch.wallMaterials === undefined) {
          compatiblePatch.wallMaterials = Object.fromEntries(["north", "east", "south", "west"].map(wall => [wall, { mode: "color", color: patch.wallColor }]));
        }
        if (patch.floorColor !== undefined && patch.floorMaterial === undefined) compatiblePatch.floorMaterial = LEGACY_FLOOR_MATERIAL;
        if (Object.entries(compatiblePatch).every(([key, value]) => JSON.stringify(c[key as keyof RoomDesign]) === JSON.stringify(value))) return;
        set({ current: cloneDesign({ ...c, ...compatiblePatch, updatedAt: Date.now() }),
          ...(!get().transaction ? { past: [...get().past, cloneDesign(c)].slice(-60), future: [] } : {}),
        });
      },
    }),
    { name: "casa-designs-guest", storage: createJSONStorage(() => roomStorage),
      partialize: ({ designs, current, cloudLinks }) => ({ schemaVersion: 1, designs, current, cloudLinks }),
      merge: (persisted, state) => {
        const saved = persisted as Partial<DesignState> | undefined;
        return { ...state, designs: saved?.designs?.map(cloneDesign) ?? [], current: saved?.current ? cloneDesign(saved.current) : null, cloudLinks: saved?.cloudLinks ?? {} };
      },
    },
  ),
);
export function setDesignOwner(userId: string | null) {
  if (typeof window === "undefined") return;

  const storageName = `casa-designs-${userId ?? "guest"}`;
  // Auth initialization and token refresh announce the same owner again. The
  // already hydrated editor is authoritative, including an active drag and undo.
  if (useDesigns.persist.getOptions().name === storageName && useDesigns.persist.hasHydrated()) return;
  let designs: RoomDesign[] = [];
  let current: RoomDesign | null = null;
  let cloudLinks: DesignState["cloudLinks"] = {};

  try {
    const saved = roomStorage.getItem(storageName);
    const parsed = saved ? readRoomLocalState(saved) : null;
    designs = parsed?.designs ?? []; current = parsed?.current ?? null; cloudLinks = parsed?.cloudLinks ?? {};
  } catch {
    designs = [];
    current = null;
  }

  useDesigns.persist.setOptions({ name: storageName });
  useDesigns.setState({ owner: userId, designs, current, cloudLinks, past: [], future: [], transaction: null });
}
