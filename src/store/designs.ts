"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  RoomDesign,
  RoomSize,
  PlacedFurniture,
  RoomType,
  RoomConnection,
  RoomPosition,
  SavedFurniture,
} from "@/lib/types";
import { getProduct } from "./catalog";
import { dimsFor } from "@/three/collision";
import {
  activateDesignRoom,
  DEFAULT_FLOOR_MATERIAL,
  LEGACY_FLOOR_MATERIAL,
  newDesignRoom,
  syncDesignRooms,
} from "@/lib/roomDesign";
import {
  connectionContact,
  defaultConnection,
  positionedRooms,
  roomContacts,
  roomsOverlap,
  snapRoomPosition,
} from "@/lib/roomLayout";
import { layoutFurnitureIssue } from "@/three/roomPlacement";
import {
  movedFurnitureId,
  reassignFurnitureRooms,
} from "@/three/furnitureRoomOwnership";
import { ROOM_TYPES } from "@/lib/roomGeometry";
import { configureAddedRoom, type AddRoomOptions } from "@/lib/addRoomOptions";
import { validateRoomSetup, type RoomSetupDimensions } from "@/lib/roomSetup";

export const ROOM_DIMENSIONS: Record<RoomSize, { w: number; d: number }> = {
  "40": { w: 6.3, d: 6.3 },
  "80": { w: 8.9, d: 8.9 },
  "120": { w: 11, d: 11 },
};

interface DesignState {
  furniture: SavedFurniture[];
  rememberFurniture: (piece: PlacedFurniture, quantity?: number) => void;
  removeFurniture: (id: string) => void;
  duplicateRoom: (id: string) => void;
  removeRoom: (id: string) => string | null;
  savePreview: (designId: string, image: string) => void;
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
  createNew: (
    size: RoomSize,
    name?: string,
    roomType?: RoomType,
    dimensions?: RoomSetupDimensions,
  ) => void;
  addRoom: (type: RoomType, options?: AddRoomOptions) => void;
  selectRoom: (id: string) => void;
  moveRoom: (
    id: string,
    position: RoomPosition,
    snap?: boolean,
  ) => string | null;
  updateConnection: (
    id: string,
    patch: Partial<RoomConnection>,
  ) => string | null;
  loadDesign: (id: string) => void;
  saveCurrent: (name?: string) => void;
  deleteDesign: (id: string) => void;
  duplicateDesign: (id: string) => void;
  updatePieces: (pieces: PlacedFurniture[]) => void;
  updateRoom: (
    patch: Partial<
      Pick<
        RoomDesign,
        | "interiorCamera"
        | "wallColor"
        | "floorColor"
        | "name"
        | "width"
        | "depth"
        | "size"
        | "height"
        | "wallFeatures"
        | "columns"
        | "roomName"
        | "roomType"
        | "openings"
        | "floorMaterial"
        | "wallMaterials"
        | "ceilingMaterial"
        | "ceiling"
        | "lighting"
        | "pieces"
      >
    >,
  ) => void;
}
const createDesignId = () => `d_${crypto.randomUUID()}`;

const cloneDesign = syncDesignRooms;

const blankDesign = (
  size: RoomSize,
  name = "Untitled Room",
  roomType?: RoomType,
  dimensions?: RoomSetupDimensions,
): RoomDesign => {
  if (dimensions) {
    const issue = validateRoomSetup(dimensions);
    if (issue) throw new Error(issue);
  }
  const dims = ROOM_DIMENSIONS[size];
  return cloneDesign({
    id: createDesignId(),
    name,
    size,
    width:
      dimensions?.width ?? (roomType ? ROOM_TYPES[roomType].width : dims.w),
    depth:
      dimensions?.depth ?? (roomType ? ROOM_TYPES[roomType].depth : dims.d),
    height: dimensions?.height ?? 2.7,
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
      designs: [],
      furniture: [],
      rememberFurniture: (piece, quantity) => {
        const product = getProduct(piece.productId),
          dimensions = dimsFor(piece);
        if (
          !Object.values(dimensions).every(
            (v) => Number.isFinite(v) && v > 0 && v <= 20,
          )
        )
          return;
        const id = `${piece.productId}:${piece.color}:${piece.material}`;
        const item: SavedFurniture = {
          id,
          piece: JSON.parse(JSON.stringify(piece)),
          name:
            product?.name ??
            piece.details?.name ??
            piece.kitchen?.name ??
            "Миний тавилга",
          dimensions: { ...dimensions },
          image: product?.image ?? piece.details?.image,
          quantity: Math.min(
            20,
            Math.max(
              1,
              Math.round(
                quantity ??
                  get().furniture.find((item) => item.id === id)?.quantity ??
                  1,
              ),
            ),
          ),
          addedAt: Date.now(),
        };
        set({
          furniture: [
            ...get().furniture.filter((item) => item.id !== id),
            item,
          ],
        });
      },
      removeFurniture: (id) =>
        set({ furniture: get().furniture.filter((item) => item.id !== id) }),
      savePreview: (designId, image) => {
        if (
          !image.startsWith("data:image/") ||
          image.length > 500_000 ||
          get().current?.id !== designId
        )
          return;
        set({
          current: { ...get().current!, previewImage: image },
          designs: get().designs.map((d) =>
            d.id === designId ? { ...d, previewImage: image } : d,
          ),
        });
      },
      duplicateRoom: (id) => {
        get().endEdit();
        const c = get().current;
        if (!c) return;
        const original = c.rooms?.find((r) => r.id === id);
        if (!original) return;
        const room = JSON.parse(JSON.stringify(original));
        room.id = `room_${crypto.randomUUID()}`;
        room.name += " хуулбар";
        delete room.position;
        room.pieces = room.pieces.map((p: PlacedFurniture) => ({
          ...p,
          instanceId: `p_${crypto.randomUUID()}`,
        }));
        for (const list of [
          room.openings,
          room.columns,
          room.wallFeatures,
          room.lighting?.fixtures,
        ])
          for (const item of list ?? []) item.id = crypto.randomUUID();
        const rooms = positionedRooms([...(c.rooms ?? []), room]);
        set({
          current: activateDesignRoom(
            { ...c, rooms, updatedAt: Date.now() },
            room.id,
          ),
          past: [...get().past, cloneDesign(c)].slice(-60),
          future: [],
        });
      },
      removeRoom: (id) => {
        get().endEdit();
        const c = get().current;
        if (!c) return null;
        const rooms = (c.rooms ?? []).filter((r) => r.id !== id);
        if (rooms.length === c.rooms?.length) return null;
        if (!rooms.length) return "Сүүлийн өрөөг устгах боломжгүй.";
        const connections = (c.connections ?? []).filter(
          (link) => link.roomA !== id && link.roomB !== id,
        );
        const issue = layoutFurnitureIssue(c, rooms, connections);
        if (issue) return issue;
        const active = rooms.some((r) => r.id === c.activeRoomId)
          ? c.activeRoomId!
          : rooms[0].id;
        const nextRoom = rooms.find(room => room.id === active)!;
        set({
          current: activateDesignRoom(
            { ...c, ...nextRoom, id: c.id, name: c.name, roomName: nextRoom.name, roomType: nextRoom.type, activeRoomId: active, rooms, connections, updatedAt: Date.now() },
            active,
          ),
          past: [...get().past, cloneDesign(c)].slice(-60),
          future: [],
        });
        return null;
      },
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
        const committed = current
          ? reassignFurnitureRooms(
              current,
              movedFurnitureId(transaction.pieces, current.pieces),
            )
          : null;
        const changed =
          committed &&
          JSON.stringify(committed) !== JSON.stringify(transaction);
        set({
          current: committed,
          transaction: null,
          ...(changed
            ? { past: [...past, transaction].slice(-60), future: [] }
            : {}),
        });
      },
      undo: () => {
        get().endEdit();
        const { past, current, future } = get();
        if (!current || !past.length) return;
        set({
          current: cloneDesign(past[past.length - 1]),
          past: past.slice(0, -1),
          future: [cloneDesign(current), ...future].slice(0, 60),
        });
      },
      redo: () => {
        get().endEdit();
        const { past, current, future } = get();
        if (!current || !future.length) return;
        set({
          current: cloneDesign(future[0]),
          past: [...past, cloneDesign(current)].slice(-60),
          future: future.slice(1),
        });
      },
      createNew: (size, name, roomType, dimensions) => {
        const next = blankDesign(size, name, roomType, dimensions);
        const { current, designs } = get();
        const previous = current ? reassignFurnitureRooms(current) : null;
        set({ current: next, designs: previous ? [...designs.filter(design => design.id !== previous.id), previous] : designs, past: [], future: [], transaction: null });
      },
      addRoom: (type, options) => {
        get().endEdit();
        const current = get().current;
        if (!current) return;
        const synced = cloneDesign(current);
        const blank = newDesignRoom(type, synced.rooms!);
        const room = positionedRooms([
          ...synced.rooms!,
          options ? configureAddedRoom(blank, options) : blank,
        ]).at(-1)!;
        const next = activateDesignRoom(
          { ...synced, rooms: [...synced.rooms!, room] },
          room.id,
        );
        set({
          current: { ...next, updatedAt: Date.now() },
          past: [...get().past, cloneDesign(current)].slice(-60),
          future: [],
        });
      },
      moveRoom: (id, position, snap = true) => {
        get().endEdit();
        const current = get().current;
        if (!current) return null;
        const synced = cloneDesign(current),
          room = synced.rooms!.find((r) => r.id === id);
        if (
          !room ||
          !Number.isFinite(position.x) ||
          !Number.isFinite(position.z)
        )
          return "Өрөөний байрлал буруу байна.";
        const result = snapRoomPosition(
          room,
          synced.rooms!,
          position,
          snap ? 0.3 : 0,
        );
        if (!result.valid)
          return "Өрөөнүүд давхцаж болохгүй. Хананд нь ойртуулж тавина уу.";
        if (JSON.stringify(result.position) === JSON.stringify(room.position))
          return null;
        const rooms = synced.rooms!.map((r) =>
          r.id === id ? { ...r, position: result.position } : r,
        );
        const connections = (synced.connections ?? []).filter((c) =>
          connectionContact(rooms, c),
        );
        const moved = rooms.find((r) => r.id === id)!;
        for (const other of rooms.filter((r) => r.id !== id))
          for (const contact of roomContacts(moved, other)) {
            if (
              !connections.some(
                (c) =>
                  (c.roomA === id &&
                    c.roomB === other.id &&
                    c.wallA === contact.wallA &&
                    c.wallB === contact.wallB) ||
                  (c.roomB === id &&
                    c.roomA === other.id &&
                    c.wallB === contact.wallA &&
                    c.wallA === contact.wallB),
              )
            )
              connections.push(defaultConnection(contact, rooms));
          }
        const furnitureIssue = layoutFurnitureIssue(synced, rooms, connections);
        if (furnitureIssue) return furnitureIssue;
        set({
          current: cloneDesign({
            ...synced,
            rooms,
            connections,
            updatedAt: Date.now(),
          }),
          past: [...get().past, cloneDesign(current)].slice(-60),
          future: [],
        });
        return null;
      },
      updateConnection: (id, patch) => {
        const current = get().current;
        if (!current) return null;
        const c = current.connections?.find((c) => c.id === id);
        if (!c) return "Холбоос олдсонгүй.";
        const next = {
          ...c,
          ...patch,
          id: c.id,
          roomA: c.roomA,
          roomB: c.roomB,
          wallA: c.wallA,
          wallB: c.wallB,
        };
        const contact = connectionContact(current.rooms ?? [], next);
        const height = Math.min(
          ...(current.rooms ?? [])
            .filter((r) => r.id === c.roomA || r.id === c.roomB)
            .map((r) => r.height ?? 2.7),
        );
        if (
          !contact ||
          !Number.isFinite(next.position) ||
          next.position < 0 ||
          next.position > 1 ||
          !Number.isFinite(next.doorWidth) ||
          !Number.isFinite(next.doorHeight) ||
          next.doorWidth < 0.3 ||
          next.doorHeight < 0.3 ||
          (next.kind === "door" &&
            (next.doorWidth + 0.12 > contact.length + 0.002 ||
              next.doorHeight + 0.06 > height))
        )
          return "Хаалганы хэмжээ нийлсэн хананд багтахгүй байна.";
        if (JSON.stringify(c) === JSON.stringify(next)) return null;
        const connections = current.connections!.map((c) =>
          c.id === id ? next : { ...c },
        );
        const furnitureIssue = layoutFurnitureIssue(
          cloneDesign(current),
          current.rooms ?? [],
          connections,
        );
        if (furnitureIssue) return furnitureIssue;
        set({
          current: cloneDesign({
            ...current,
            connections,
            updatedAt: Date.now(),
          }),
          ...(!get().transaction
            ? {
                past: [...get().past, cloneDesign(current)].slice(-60),
                future: [],
              }
            : {}),
        });
        return null;
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
          set({
            current: cloneDesign(design),
            past: [],
            future: [],
            transaction: null,
          });
        }
      },
      saveCurrent: (name) => {
        const current = get().current;
        if (!current) return;

        const saved: RoomDesign = reassignFurnitureRooms({
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
          ...(state.current?.id === id
            ? { past: [], future: [], transaction: null }
            : {}),
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
        const next = cloneDesign({ ...c, pieces, updatedAt: Date.now() });
        set({
          current: get().transaction
            ? next
            : reassignFurnitureRooms(next, movedFurnitureId(c.pieces, pieces)),
          ...(!get().transaction
            ? { past: [...get().past, cloneDesign(c)].slice(-60), future: [] }
            : {}),
        });
      },
      updateRoom: (patch) => {
        const c = get().current;
        if (!c) return;
        if (
          patch.width !== undefined ||
          patch.depth !== undefined ||
          patch.wallFeatures !== undefined ||
          patch.columns !== undefined
        ) {
          const rooms = c.rooms ?? [];
          const active = rooms.find((r) => r.id === c.activeRoomId);
          if (
            active &&
            rooms.some(
              (r) =>
                r.id !== active.id &&
                roomsOverlap(
                  { ...active, ...patch, name: active.name, type: active.type },
                  r,
                ),
            )
          )
            return;
        }
        const compatiblePatch = { ...patch };
        // Older integrations edit a single colour; keep that action effective after migration.
        if (
          patch.wallColor !== undefined &&
          patch.wallMaterials === undefined
        ) {
          compatiblePatch.wallMaterials = Object.fromEntries(
            ["north", "east", "south", "west"].map((wall) => [
              wall,
              { mode: "color", color: patch.wallColor },
            ]),
          );
        }
        if (patch.floorColor !== undefined && patch.floorMaterial === undefined)
          compatiblePatch.floorMaterial = LEGACY_FLOOR_MATERIAL;
        if (
          Object.entries(compatiblePatch).every(
            ([key, value]) =>
              JSON.stringify(c[key as keyof RoomDesign]) ===
              JSON.stringify(value),
          )
        )
          return;
        set({
          current: cloneDesign({
            ...c,
            ...compatiblePatch,
            updatedAt: Date.now(),
          }),
          ...(!get().transaction
            ? { past: [...get().past, cloneDesign(c)].slice(-60), future: [] }
            : {}),
        });
      },
    }),
    {
      name: "casa-designs-guest",
      partialize: ({ designs, current, furniture }) => ({
        designs,
        current,
        furniture,
      }),
      merge: (persisted, state) => {
        const saved = persisted as Partial<DesignState> | undefined;
        return {
          ...state,
          furniture: saved?.furniture ?? [],
          designs: saved?.designs?.map(cloneDesign) ?? [],
          current: saved?.current ? cloneDesign(saved.current) : null,
        };
      },
    },
  ),
);
export function setDesignOwner(userId: string | null) {
  if (typeof window === "undefined") return;

  const storageName = `casa-designs-${userId ?? "guest"}`;
  // Auth initialization and token refresh announce the same owner again. The
  // already hydrated editor is authoritative, including an active drag and undo.
  if (
    useDesigns.persist.getOptions().name === storageName &&
    useDesigns.persist.hasHydrated()
  )
    return;
  let designs: RoomDesign[] = [];
  let current: RoomDesign | null = null;
  let furniture: SavedFurniture[] = [];

  try {
    const saved = window.localStorage.getItem(storageName);
    const parsed = saved
      ? (JSON.parse(saved) as {
          state?: {
            designs?: RoomDesign[];
            current?: RoomDesign | null;
            furniture?: SavedFurniture[];
          };
        })
      : null;

    if (Array.isArray(parsed?.state?.designs)) {
      designs = parsed.state.designs.map(cloneDesign);
    }

    current = parsed?.state?.current ? cloneDesign(parsed.state.current) : null;
    furniture = Array.isArray(parsed?.state?.furniture)
      ? parsed.state.furniture
      : [];
  } catch {
    designs = [];
    current = null;
  }

  useDesigns.persist.setOptions({ name: storageName });
  useDesigns.setState({
    designs,
    current,
    furniture,
    past: [],
    future: [],
    transaction: null,
  });
}
