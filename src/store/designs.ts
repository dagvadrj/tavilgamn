"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { instantiateRoomTemplate } from "@/lib/roomTemplates";
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
import { dimsFor, isPlacementValid } from "@/three/collision";
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
  placeAdjacentRoom,
} from "@/lib/roomLayout";
import { activeRoomPlacementContext, layoutFurnitureIssue, roomPlacementContext } from "@/three/roomPlacement";
import { assessKitchenRoomFit } from "@/lib/kitchenRoomFit";
import type { KitchenSnapshot } from "@/lib/kitchenAssembly";
import {
  movedFurnitureId,
  reassignFurnitureRooms,
} from "@/three/furnitureRoomOwnership";
import { ROOM_TYPES, validateRoomShape } from "@/lib/roomGeometry";
import { configureAddedRoom, type AddRoomOptions } from "@/lib/addRoomOptions";
import { validateRoomSetup, type RoomSetupDimensions } from "@/lib/roomSetup";
import { createRoomBuilderDraft, resizeRoomBuilder, type RoomBuilderDraft } from "@/lib/roomBuilderDraft";
import { findInitialFurniturePlacement, initialPlacementFailure, resolveFurnitureAttachments, type InitialPlacementHints } from "@/lib/furnitureAttachment";

export const ROOM_DIMENSIONS: Record<RoomSize, { w: number; d: number }> = {
  "40": { w: 6.3, d: 6.3 },
  "80": { w: 8.9, d: 8.9 },
  "120": { w: 11, d: 11 },
};

interface DesignState {
  importTemplate: (design: RoomDesign) => void;
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
    initial?: RoomBuilderDraft,
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
  placeFurniture: (piece: PlacedFurniture, hints?: InitialPlacementHints) => { piece: PlacedFurniture | null; error: string | null };
  placeKitchen: (saved: KitchenSnapshot) => { piece: PlacedFurniture | null; error: string | null; message: string };
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
        | "outline"
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
      importTemplate: (source) => {
        const copy = instantiateRoomTemplate(source);
        get().endEdit();
        get().saveCurrent();
        set(state => ({ current: copy, designs: [...state.designs, copy], past: [], future: [], transaction: null }));
      },
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
        const instanceIds = new Map<string, string>(room.pieces.map((p: PlacedFurniture) => [p.instanceId, `p_${crypto.randomUUID()}`]));
        room.pieces = room.pieces.map((p: PlacedFurniture) => ({
          ...p,
          instanceId: instanceIds.get(p.instanceId)!,
          ...(p.attachment?.kind === "wall" ? { attachment: { ...p.attachment, roomId:room.id } } : p.attachment?.kind === "surface" ? { attachment: { ...p.attachment, parentInstanceId:instanceIds.get(p.attachment.parentInstanceId)! } } : {}),
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
      createNew: (size, name, roomType, dimensions, initial) => {
        const base = blankDesign(size, name, roomType, dimensions);
        const next = initial ? cloneDesign({ ...base, ...createRoomBuilderDraft(initial) }) : base;
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
        const room = placeAdjacentRoom(options ? configureAddedRoom(blank, options) : blank, synced.rooms!, synced.activeRoomId);
        const allRooms = [...synced.rooms!, room];
        const connections = [...(synced.connections ?? []), ...synced.rooms!.flatMap(other => roomContacts(room, other).map(contact => defaultConnection(contact, allRooms)))];
        const next = activateDesignRoom(
          { ...synced, rooms: allRooms, connections },
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
      placeFurniture: (piece, hints) => {
        const current = get().current;
        const failure = (error: string) => ({ piece: null, error });
        if (!current) return failure("Эхлээд өрөөгөө сонгоно уу.");
        if (get().transaction) return failure("Одоогийн засвараа дуусгаад тавилгаа дахин нэмнэ үү.");
        if ((current.rooms ?? [{ pieces: current.pieces }]).some(room => room.pieces.some(p => p.instanceId === piece.instanceId))) return failure("Энэ тавилга аль хэдийн нэмэгдсэн байна.");
        try {
          const context = roomPlacementContext(current);
          const placed = findInitialFurniturePlacement(piece, context.pieces, context.room, current.activeRoomId ?? `${current.id}-room-1`, hints);
          if (!placed) return failure(initialPlacementFailure(piece));
          get().updatePieces([...current.pieces, placed]);
          const committed = get().current?.pieces.find(p => p.instanceId === placed.instanceId);
          return committed ? { piece: committed, error: null } : failure("Өрөөний байрлал өөрчлөгдсөн байна. Тавилгаа дахин нэмнэ үү.");
        } catch {
          return failure("Өрөө эсвэл тавилгын бэхэлгээний мэдээлэл тохирохгүй байна. Өрөөний тохиргоогоо шалгана уу.");
        }
      },
      placeKitchen: (saved) => {
        const current = get().current;
        const failure = (error: string) => ({ piece: null, error, message: error });
        if (!current) return failure("Эхлээд өрөөгөө сонгоно уу.");
        if (get().transaction) return failure("Одоогийн засвараа дуусгаад дахин байрлуулна уу.");
        const context = activeRoomPlacementContext(current);
        const fit = assessKitchenRoomFit(saved, context.pieces, context.room, `p_${crypto.randomUUID()}`);
        if (!fit.placement) return failure(fit.message);
        get().updatePieces([...current.pieces, fit.placement]);
        const piece = get().current?.pieces.find(item => item.instanceId === fit.placement!.instanceId);
        return piece ? { piece, error: null, message: fit.message }
          : failure("Өрөөний байрлал өөрчлөгдсөн байна. Гарнитураа дахин сонгоно уу.");
      },
      updatePieces: (pieces) => {
        const c = get().current;
        if (!c) return;
        try { pieces = resolveFurnitureAttachments(pieces, c, c.activeRoomId ?? `${c.id}-room-1`); } catch { return; }
        if (JSON.stringify(c.pieces) === JSON.stringify(pieces)) return;
        const next = cloneDesign({ ...c, pieces, updatedAt: Date.now() });
        const context = roomPlacementContext(next);
        // Validate changed footprints, including unbound floor pieces. Existing
        // legacy errors must not prevent fixing or deleting a different item.
        if (pieces.some(piece => {
          const previous = c.pieces.find(p => p.instanceId === piece.instanceId);
          return JSON.stringify(previous) !== JSON.stringify(piece)
            && !isPlacementValid(piece, context.pieces, context.room);
        })) return;
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
        if(c.outline && !patch.outline && (patch.width!==undefined||patch.depth!==undefined))patch={...patch,outline:resizeRoomBuilder(createRoomBuilderDraft(c),patch.width??c.width,patch.depth??c.depth).outline};
        if((patch.outline||c.outline)&&validateRoomShape({...c,...patch}))return;
        if (
          patch.width !== undefined ||
          patch.depth !== undefined ||
          patch.wallFeatures !== undefined ||
          patch.outline !== undefined ||
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
        if (patch.lighting?.fixtures && patch.lighting.fixtureLayout === undefined)
          compatiblePatch.lighting = { ...patch.lighting, fixtureLayout: "manual" };
        try {
          const pieces = resolveFurnitureAttachments(patch.pieces ?? c.pieces, { ...c, ...patch }, c.activeRoomId ?? `${c.id}-room-1`);
          if (JSON.stringify(pieces) !== JSON.stringify(c.pieces) || patch.pieces) compatiblePatch.pieces = pieces;
        } catch { return; }
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

  let handoff: RoomDesign | null = null;
  if (userId) {
    try {
      const pending = JSON.parse(window.sessionStorage.getItem("casa-room-auth-handoff") ?? "null");
      if (pending?.source === "guest" && Number.isFinite(pending.createdAt) && Date.now() - pending.createdAt >= 0 && Date.now() - pending.createdAt < 86400000 && /^d_[a-f0-9-]{36}$/i.test(pending.design?.id)) {
        handoff = cloneDesign(pending.design);
        // Never overwrite a project already belonging to the signed-in account.
        if (designs.some(design => design.id === handoff!.id)) handoff = null;
        if (handoff) { designs = [...designs, handoff]; current = handoff; }
      }
    } catch { /* A missing or invalid handoff must not affect the account library. */ }
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
  if (handoff) {
    const stored = JSON.parse(window.localStorage.getItem(storageName) ?? "null");
    if (stored?.state?.current?.id === handoff.id) window.sessionStorage.removeItem("casa-room-auth-handoff");
  }
}

/** Explicitly carry only the open guest project through this tab's sign-in. */
export function prepareRoomAuthReturn(): string {
  const store = useDesigns.getState();
  store.endEdit();
  store.saveCurrent();
  const current = useDesigns.getState().current;
  if (!current) return "/planner";
  let id = current.id;
  if (useDesigns.persist.getOptions().name === "casa-designs-guest") {
    // A separate identity keeps existing account projects and the guest original intact.
    const design = cloneDesign({ ...current, id: createDesignId() });
    const pending = JSON.stringify({ source: "guest", createdAt: Date.now(), design });
    window.sessionStorage.setItem("casa-room-auth-handoff", pending);
    if (window.sessionStorage.getItem("casa-room-auth-handoff") !== pending) throw new Error("Нэвтрэхийн өмнө загварыг хадгалж чадсангүй. Browser-ийн хадгалалтын зөвшөөрлийг шалгана уу.");
    id = design.id;
  }
  return `/planner?design=${encodeURIComponent(id)}`;
}
