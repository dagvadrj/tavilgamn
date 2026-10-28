"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  Armchair,
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  X,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { ROOM_TYPES } from "@/lib/roomGeometry";
import { templateFootprint } from "@/lib/roomTemplates";
import type { RoomType } from "@/lib/types";
import {
  countMerchantRooms,
  filterMerchantRooms,
  MERCHANT_ROOM_FILTERS,
  MERCHANT_ROOM_STATE_LABEL,
  merchantRoomActions,
  merchantRoomState,
  merchantRoomUpdated,
  merchantRoomVersion,
  type MerchantRoom,
  type MerchantRoomAction,
  type MerchantRoomFilter,
} from "@/lib/merchantRooms";
import "./merchant-rooms.css";

const ROOM_KINDS = Object.entries(ROOM_TYPES).filter(([id]) => id !== "kitchen");
export const START_SIZES = [
  { id: "5x4", label: "5 × 4 м", sub: "20 м² · зочны", width: 5, depth: 4 },
  { id: "4x3.5", label: "4 × 3.5 м", sub: "14 м² · унтлагын", width: 4, depth: 3.5 },
  { id: "custom", label: "Өөрийн", sub: "Editor-т тохируулна", width: 0, depth: 0 },
] as const;

/** Editor URL of a room; a new room carries its starting name, type and size. */
export function merchantRoomEditorHref(
  id: string,
  start?: { title: string; roomType: RoomType; width: number; depth: number },
) {
  const params = new URLSearchParams({ merchantRoom: id });
  if (start) {
    params.set("title", start.title);
    params.set("type", start.roomType);
    if (start.width && start.depth) {
      params.set("w", String(start.width));
      params.set("d", String(start.depth));
    }
  }
  return `/planner?${params}`;
}

const roomMeta = (room: MerchantRoom) =>
  [
    ROOM_TYPES[room.roomType]?.label,
    `${Math.round(room.area)} м²`,
    templateFootprint(room),
    room.furnishing === "full" ? "Бүрэн" : "Хэсэгчлэн",
  ]
    .filter(Boolean)
    .join(" · ");

export function MerchantRooms({ owner }: { owner: string }) {
  const [rooms, setRooms] = useState<MerchantRoom[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<MerchantRoomFilter>("active");
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState<MerchantRoom | null>(null);
  const [toast, setToast] = useState<{
    text: string;
    undo?: { room: MerchantRoom; action: MerchantRoomAction[] };
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    void authFetch("/api/merchant/room-templates", { signal: controller.signal }, owner)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!controller.signal.aborted) setRooms(data.rooms);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : "Өрөөнүүдийг ачаалж чадсангүй.");
      });
    return () => controller.abort();
  }, [owner, attempt]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!menu) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof PointerEvent && (event.target as Element).closest?.(".merchant-room-menu")) return;
      setMenu(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menu]);

  const run = useCallback(
    async (room: MerchantRoom, steps: MerchantRoomAction[]) => {
      setBusy(room.id);
      setMenu(null);
      let current = room;
      try {
        for (const action of steps) {
          const response = await authFetch(
            "/api/merchant/room-templates",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: current.id, version: current.version, action }),
            },
            owner,
          );
          const data = await response.json();
          if (response.status === 409) {
            setToast({ text: "Өрөө өөр газар шинэчлэгдсэн байна. Жагсаалтыг дахин ачааллаа." });
            setAttempt((value) => value + 1);
            return null;
          }
          if (!response.ok) throw new Error(data.error);
          const next = data.room as MerchantRoom;
          setRooms((list) =>
            action === "duplicate"
              ? [next, ...(list ?? [])]
              : (list ?? []).map((item) => (item.id === next.id ? next : item)),
          );
          if (action !== "duplicate") current = next;
          else return next;
        }
        return current;
      } catch (reason) {
        setToast({ text: reason instanceof Error ? reason.message : "Үйлдэл амжилтгүй." });
        return null;
      } finally {
        setBusy(null);
      }
    },
    [owner],
  );
  const act = async (room: MerchantRoom, action: MerchantRoomAction) => {
    const done = await run(room, [action]);
    if (!done) return;
    if (action === "duplicate") setToast({ text: "Хуулбар ноорог үүслээ" });
    if (action === "publish")
      setToast({ text: `«${done.title}» галерейд нийтлэгдлээ` });
    if (action === "restore") setToast({ text: "Ноорог болгож сэргээлээ" });
    // Leaving the gallery can be undone from the toast.
    if (action === "unpublish")
      setToast({ text: "Галерейгаас хасагдлаа", undo: { room: done, action: ["publish"] } });
    if (action === "archive")
      setToast({
        text: "Архивлагдлаа",
        undo: {
          room: done,
          action: room.status === "published" ? ["restore", "publish"] : ["restore"],
        },
      });
  };

  const counts = rooms ? countMerchantRooms(rooms) : null;
  const visible = rooms ? filterMerchantRooms(rooms, filter, query) : [];
  return (
    <section className="merchant-rooms" aria-labelledby="merchant-rooms-title">
      <header className="merchant-rooms-head">
        <div>
          <h2 id="merchant-rooms-title">Тохижуулсан өрөөнүүд</h2>
          <p>Өөрийн бараагаар бодит 3D өрөө бүтээж, хэрэглэгчийн галерейд нийтэлнэ.</p>
        </div>
        <button type="button" className="is-primary" onClick={() => setCreating(true)}>
          <Plus size={17} aria-hidden="true" /> Шинэ өрөө
        </button>
      </header>
      <div className="merchant-rooms-tools">
        <div role="group" aria-label="Төлөвөөр шүүх">
          {MERCHANT_ROOM_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={filter === item.id}
              data-filter={item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
              {counts && <span>{counts[item.id]}</span>}
            </button>
          ))}
        </div>
        <label className="merchant-rooms-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Өрөө хайх</span>
          <input
            type="search"
            placeholder="Өрөө хайх"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      {error && (
        <div className="merchant-rooms-state is-error" role="alert">
          <AlertTriangle size={20} aria-hidden="true" />
          <span>{error}</span>
          <button type="button" onClick={() => setAttempt((value) => value + 1)}>
            Дахин оролдох
          </button>
        </div>
      )}
      {!rooms && !error && (
        <div className="merchant-rooms-skeleton" role="status" aria-label="Өрөөнүүдийг ачаалж байна…">
          {[0, 1, 2].map((index) => (
            <span key={index} aria-hidden="true" />
          ))}
        </div>
      )}
      {rooms && (
        <div className="merchant-rooms-table" role="table" aria-label="Тохижуулсан өрөөнүүд">
          <div className="merchant-rooms-row is-head" role="row">
            <span role="columnheader">Харагдац</span>
            <span role="columnheader">Өрөө</span>
            <span role="columnheader">Төлөв</span>
            <span role="columnheader">Сүүлд засварласан</span>
            <span role="columnheader">Үйлдэл</span>
          </div>
          {visible.map((room) => {
            const state = merchantRoomState(room);
            return (
              <div key={room.id} className="merchant-rooms-row" role="row" aria-busy={busy === room.id}>
                <span role="cell" className="merchant-rooms-thumb">
                  {room.previewImage ? (
                    <Image unoptimized src={room.previewImage} width={160} height={100} alt={`${room.title} — харагдац`} />
                  ) : (
                    <Armchair size={22} aria-hidden="true" />
                  )}
                </span>
                <span role="cell" className="merchant-rooms-name">
                  <strong>{room.title}</strong>
                  <small>{roomMeta(room)}</small>
                  {state === "attention" && (
                    <small className="merchant-rooms-warning">
                      <AlertTriangle size={13} aria-hidden="true" />
                      {room.missingModels} загвар ачаалагдсангүй — нийтлэх боломжгүй
                    </small>
                  )}
                </span>
                <span role="cell" className="merchant-rooms-status">
                  <span className="merchant-room-pill" data-state={state}>
                    {MERCHANT_ROOM_STATE_LABEL[state]}
                  </span>
                  <small>{merchantRoomVersion(room)}</small>
                </span>
                <span role="cell" className="merchant-rooms-updated">
                  {merchantRoomUpdated(room.updatedAt)}
                </span>
                <span role="cell" className="merchant-rooms-actions">
                  <Link href={merchantRoomEditorHref(room.id)} className="merchant-room-button">
                    <Pencil size={15} aria-hidden="true" /> Засах
                  </Link>
                  <button type="button" className="merchant-room-button" onClick={() => setPreview(room)}>
                    <Eye size={15} aria-hidden="true" /> Урьдчилж харах
                  </button>
                  <span className="merchant-room-menu">
                    <button
                      type="button"
                      className="merchant-room-icon"
                      aria-label={`${room.title} — бусад үйлдэл`}
                      aria-haspopup="menu"
                      aria-expanded={menu === room.id}
                      disabled={busy === room.id}
                      onClick={() => setMenu((value) => (value === room.id ? null : room.id))}
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    {menu === room.id && (
                      <span role="menu" aria-label={`${room.title} — бусад үйлдэл`}>
                        {merchantRoomActions(room).map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            role="menuitem"
                            disabled={item.disabled}
                            data-danger={item.id === "archive" || item.id === "unpublish" || undefined}
                            onClick={() => void act(room, item.id)}
                          >
                            {item.label}
                            {item.reason && <small>{item.reason}</small>}
                          </button>
                        ))}
                      </span>
                    )}
                  </span>
                </span>
              </div>
            );
          })}
          {!visible.length && (
            <p className="merchant-rooms-empty">
              {rooms.length ? "Энэ төлөвт өрөө алга." : "Одоогоор өрөө алга. «Шинэ өрөө»-өөр эхлээрэй."}
            </p>
          )}
        </div>
      )}
      <p className="merchant-rooms-note">
        Нийтэлсэн өрөөг засахад шинэ ноорог хувилбар үүснэ; хэрэглэгчид «Нийтлэх»
        дарах хүртэл хуучин хувилбарыг харна.
      </p>

      {creating && <NewRoomDialog onClose={() => setCreating(false)} />}
      {preview && <RoomPreviewDialog room={preview} onClose={() => setPreview(null)} />}
      {toast && (
        <div className="merchant-rooms-toast" role="status">
          <span>{toast.text}</span>
          {toast.undo && (
            <button
              type="button"
              onClick={() => {
                const undo = toast.undo!;
                setToast(null);
                void run(undo.room, undo.action);
              }}
            >
              Буцаах
            </button>
          )}
          <button type="button" aria-label="Мэдэгдэл хаах" onClick={() => setToast(null)}>
            <X size={15} />
          </button>
        </div>
      )}
    </section>
  );
}

function Dialog({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>("input, button.is-primary, button")?.focus();
    return () => opener?.focus?.();
  }, []);
  return (
    <div className="merchant-rooms-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={box}
        className="merchant-rooms-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
      >
        <button type="button" className="merchant-rooms-dialog-close" aria-label="Хаах" onClick={onClose}>
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}

/** «Шинэ өрөө»: name, type and starting size, then the editor (C3). */
function NewRoomDialog({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [roomType, setRoomType] = useState<RoomType>("living");
  const [size, setSize] = useState<(typeof START_SIZES)[number]["id"]>("5x4");
  const start = START_SIZES.find((item) => item.id === size)!;
  return (
    <Dialog label="Шинэ тохижуулсан өрөө" onClose={onClose}>
      <h3>Шинэ тохижуулсан өрөө</h3>
      <form
        className="merchant-rooms-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) return;
          window.location.assign(
            merchantRoomEditorHref("new", {
              title: title.trim(),
              roomType,
              width: start.width,
              depth: start.depth,
            }),
          );
        }}
      >
        <label>
          Өрөөний нэр
          <input required maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          Өрөөний төрөл
          <select value={roomType} onChange={(event) => setRoomType(event.target.value as RoomType)}>
            {ROOM_KINDS.map(([id, type]) => (
              <option key={id} value={id}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>Эхлэх хэмжээ</legend>
          {START_SIZES.map((item) => (
            <label key={item.id} className="merchant-rooms-size">
              <input type="radio" name="size" checked={size === item.id} onChange={() => setSize(item.id)} />
              <span>
                <strong>{item.label}</strong>
                <small>{item.sub}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="merchant-rooms-dialog-actions">
          <button type="button" onClick={onClose}>
            Болих
          </button>
          <button type="submit" className="is-primary" disabled={!title.trim()}>
            Үүсгээд editor нээх
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** Shows exactly what shoppers get; an unpublished room has no cover to show. */
function RoomPreviewDialog({ room, onClose }: { room: MerchantRoom; onClose: () => void }) {
  return (
    <Dialog label={`${room.title} — урьдчилсан харагдац`} onClose={onClose}>
      <small>Галерейд ингэж харагдана</small>
      <div className="merchant-rooms-preview">
        {room.previewImage && room.missingModels === 0 ? (
          <Image unoptimized src={room.previewImage} width={768} height={480} alt={`${room.title} — cover`} />
        ) : (
          <div className="merchant-rooms-cover-missing">
            <strong>Cover бэлэн биш</strong>
            <span>
              {room.missingModels
                ? `${room.missingModels} загвар ачаалагдаагүй тул дуусаагүй зургийг cover болгохгүй.`
                : "Editor-т бүх загвар ачаалагдсаны дараа «Нийтлэх» үед cover үүснэ."}
            </span>
          </div>
        )}
      </div>
      <h3>{room.title}</h3>
      <p>
        {roomMeta(room)} · {room.pieceCount} тавилга
      </p>
      <p className="merchant-rooms-note">
        {room.status === "published" && !room.draftVersion
          ? "Хэрэглэгчид одоо энэ хувилбарыг харж байна."
          : "Нийтлэх хүртэл хэрэглэгчид харагдахгүй."}
      </p>
      <div className="merchant-rooms-dialog-actions">
        <button type="button" onClick={onClose}>
          Хаах
        </button>
        <Link href={merchantRoomEditorHref(room.id)} className="is-primary">
          Засах
        </Link>
      </div>
    </Dialog>
  );
}
