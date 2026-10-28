import type { RoomType } from "./types";
import type { RoomTemplateStatus } from "./roomTemplates";

/** One furnished room in a merchant's list (C2). */
export interface MerchantRoom {
  id: string;
  title: string;
  description: string;
  roomType: RoomType;
  area: number;
  furnishing: "full" | "partial";
  status: RoomTemplateStatus;
  /** Concurrency token; also the number of the latest saved version. */
  version: number;
  publishedVersion: number | null;
  /** Set while a published room has unpublished edits. */
  draftVersion: number | null;
  updatedAt: string;
  /** Public cover of the published version; empty for unpublished rooms. */
  previewImage: string;
  pieceCount: number;
  width: number | null;
  depth: number | null;
  /** Placed pieces whose 3D delivery is retired or missing. */
  missingModels: number;
}

export type MerchantRoomState = "draft" | "published" | "archived" | "attention";
export type MerchantRoomFilter = "active" | MerchantRoomState;

export const MERCHANT_ROOM_FILTERS: { id: MerchantRoomFilter; label: string }[] =
  [
    { id: "active", label: "Идэвхтэй" },
    { id: "draft", label: "Ноорог" },
    { id: "published", label: "Нийтэлсэн" },
    { id: "attention", label: "Анхаарах" },
    { id: "archived", label: "Архив" },
  ];

export const MERCHANT_ROOM_STATE_LABEL: Record<MerchantRoomState, string> = {
  draft: "Ноорог",
  published: "Нийтэлсэн",
  archived: "Архивласан",
  attention: "Анхаарах",
};

/** A room with missing 3D models needs attention before anything else. */
export function merchantRoomState(room: MerchantRoom): MerchantRoomState {
  if (room.status === "archived") return "archived";
  if (room.missingModels > 0) return "attention";
  return room.status === "published" ? "published" : "draft";
}

/** «v12 нийтлэгдсэн · v13 ноорог», «Ноорог v7 · нийтлээгүй», «v4 архивласан». */
export function merchantRoomVersion(room: MerchantRoom) {
  if (room.status === "archived")
    return `v${room.publishedVersion ?? room.version} архивласан`;
  if (room.status === "published")
    return room.draftVersion
      ? `v${room.publishedVersion ?? room.version} нийтлэгдсэн · v${room.draftVersion} ноорог`
      : `v${room.publishedVersion ?? room.version} нийтлэгдсэн`;
  return room.publishedVersion
    ? `Ноорог v${room.version}`
    : `Ноорог v${room.version} · нийтлээгүй`;
}

export function filterMerchantRooms(
  rooms: MerchantRoom[],
  filter: MerchantRoomFilter,
  query = "",
) {
  const needle = query.trim().toLocaleLowerCase("mn");
  return rooms.filter((room) => {
    const state = merchantRoomState(room);
    if (filter === "active" ? state === "archived" : state !== filter)
      return false;
    return !needle || room.title.toLocaleLowerCase("mn").includes(needle);
  });
}

export function countMerchantRooms(rooms: MerchantRoom[]) {
  return Object.fromEntries(
    MERCHANT_ROOM_FILTERS.map(({ id }) => [
      id,
      filterMerchantRooms(rooms, id).length,
    ]),
  ) as Record<MerchantRoomFilter, number>;
}

export type MerchantRoomAction =
  | "duplicate"
  | "publish"
  | "unpublish"
  | "archive"
  | "restore";

/** The «•••» menu for one room; publishing is disabled with its reason. */
export function merchantRoomActions(room: MerchantRoom) {
  const state = merchantRoomState(room);
  const items: {
    id: MerchantRoomAction;
    label: string;
    disabled?: boolean;
    reason?: string;
  }[] = [{ id: "duplicate", label: "Хувилж шинэ ноорог үүсгэх" }];
  if (state === "archived")
    return [...items, { id: "restore" as const, label: "Ноорог болгож сэргээх" }];
  if (state === "attention")
    items.push({
      id: "publish",
      label: "Нийтлэх боломжгүй",
      disabled: true,
      reason: "Editor-т ачаалагдаагүй загварыг засна уу.",
    });
  else if (room.status !== "published" || room.draftVersion)
    items.push({ id: "publish", label: "Нийтлэх" });
  if (room.status === "published")
    items.push({ id: "unpublish", label: "Нийтлэлээс авах" });
  items.push({ id: "archive", label: "Архивлах" });
  return items;
}

/** «Өнөөдөр 14:05», «Өчигдөр 18:20», «Дөнгөж сая», otherwise the date. */
export function merchantRoomUpdated(iso: string, now = new Date()) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  if (now.getTime() - date.getTime() < 60_000) return "Дөнгөж сая";
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  const day = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((day(now) - day(date)) / 86_400_000);
  if (days === 0) return `Өнөөдөр ${time}`;
  if (days === 1) return `Өчигдөр ${time}`;
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

export interface PublishCheck {
  id: "models" | "name" | "cover" | "description";
  title: string;
  note: string;
  ok: boolean;
  /** A blocking failure disables «Нийтлэх». */
  blocking: boolean;
  /** Instance to select from «Харуулах». */
  showInstanceId?: string;
}

/** C3 publish modal: every 3D model loaded, a name, a cover, a description. */
export function publishChecklist({
  title,
  roomTypeLabel,
  description,
  pieces,
  coverReady,
}: {
  title: string;
  roomTypeLabel: string;
  description: string;
  /** Load state of every placed piece in the room. */
  pieces: { instanceId: string; name: string; state: "ready" | "loading" | "error" }[];
  coverReady: boolean;
}): PublishCheck[] {
  const failed = pieces.filter((piece) => piece.state === "error");
  const loading = pieces.filter((piece) => piece.state === "loading");
  const ready = pieces.length - failed.length - loading.length;
  return [
    failed.length
      ? {
          id: "models",
          title: `${failed.length} загвар ачаалагдсангүй`,
          note: `${failed[0].name} — cover зураг үүсэхгүй.`,
          ok: false,
          blocking: true,
          showInstanceId: failed[0].instanceId,
        }
      : loading.length
        ? {
            id: "models",
            title: `${loading.length} загвар ачаалж байна`,
            note: "Загварууд ачаалж дуусахыг хүлээж байна.",
            ok: false,
            blocking: true,
            showInstanceId: loading[0].instanceId,
          }
        : {
            id: "models",
            title: "Бүх 3D загвар ачаалагдсан",
            note: `${ready} тавилга бэлэн.`,
            ok: true,
            blocking: false,
          },
    title.trim()
      ? {
          id: "name",
          title: "Нэр ба өрөөний төрөл",
          note: `${title.trim()} · ${roomTypeLabel}`,
          ok: true,
          blocking: false,
        }
      : {
          id: "name",
          title: "Нэр хоосон",
          note: "Нэр оруулна уу.",
          ok: false,
          blocking: true,
        },
    coverReady
      ? {
          id: "cover",
          title: "Cover өнцөг",
          note: "Одоогийн харагдацаас үүснэ.",
          ok: true,
          blocking: false,
        }
      : {
          id: "cover",
          title: "Cover бэлэн биш",
          note: "Бүх загвар ачаалагдсаны дараа зураг үүснэ.",
          ok: false,
          blocking: true,
        },
    description.trim()
      ? {
          id: "description",
          title: "Тайлбар",
          note: "Нэмсэн.",
          ok: true,
          blocking: false,
        }
      : {
          id: "description",
          title: "Тайлбар",
          note: "Заавал биш, гэхдээ галерейд илүү ойлгомжтой болгоно.",
          ok: false,
          blocking: false,
        },
  ];
}

/** Version conflict reported by save/publish (C3): never overwritten silently. */
export interface MerchantRoomConflict {
  version: number;
  updatedAt: string;
}
