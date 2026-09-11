"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RoomDesign, RoomSize, PlacedFurniture, RoomType } from "@/lib/types";
import { activateDesignRoom, newDesignRoom, syncDesignRooms } from "@/lib/roomDesign";
import { ROOM_TYPES } from "@/lib/roomGeometry";

export const ROOM_DIMENSIONS: Record<RoomSize, { w: number; d: number }> = {
  "40": { w: 6.3, d: 6.3 },
  "80": { w: 8.9, d: 8.9 },
  "120": { w: 11, d: 11 },
};

interface DesignState {
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
  updateRoom: (patch: Partial<Pick<RoomDesign, "wallColor" | "floorColor" | "name" | "width" | "depth" | "size" | "height" | "wallFeatures" | "columns" | "roomName" | "roomType">>) => void;
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
    pieces: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
};

export const useDesigns = create<DesignState>()(
  persist(
    (set, get) => ({
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
      createNew: (size, name, roomType) => set({ current: blankDesign(size, name, roomType), past: [], future: [], transaction: null }),
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
        if (Object.entries(patch).every(([key, value]) => c[key as keyof RoomDesign] === value)) return;
        set({ current: cloneDesign({ ...c, ...patch, updatedAt: Date.now() }),
          ...(!get().transaction ? { past: [...get().past, cloneDesign(c)].slice(-60), future: [] } : {}),
        });
      },
    }),
    { name: "casa-designs-guest", partialize: ({ designs, current }) => ({ designs, current }),
      merge: (persisted, state) => {
        const saved = persisted as Partial<DesignState> | undefined;
        return { ...state, designs: saved?.designs?.map(cloneDesign) ?? [], current: saved?.current ? cloneDesign(saved.current) : null };
      },
    },
  ),
);
export function setDesignOwner(userId: string | null) {
  if (typeof window === "undefined") return;

  const storageName = `casa-designs-${userId ?? "guest"}`;
  let designs: RoomDesign[] = [];
  let current: RoomDesign | null = null;

  try {
    const saved = window.localStorage.getItem(storageName);
    const parsed = saved
      ? (JSON.parse(saved) as {
          state?: {
            designs?: RoomDesign[];
            current?: RoomDesign | null;
          };
        })
      : null;

    if (Array.isArray(parsed?.state?.designs)) {
      designs = parsed.state.designs.map(cloneDesign);
    }

    current = parsed?.state?.current ? cloneDesign(parsed.state.current) : null;
  } catch {
    designs = [];
    current = null;
  }

  useDesigns.persist.setOptions({ name: storageName });
  useDesigns.setState({ designs, current, past: [], future: [], transaction: null });
}
