"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  Eye,
  Loader2,
  PencilRuler,
  X,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@/store/auth";
import { useRoomModelStatus } from "@/store/roomModelStatus";
import { useDesigns } from "@/store/designs";
import { ROOM_TYPES } from "@/lib/roomGeometry";
import { templateFootprint, templateId } from "@/lib/roomTemplates";
import type { RoomDesign, RoomType } from "@/lib/types";
import {
  publishChecklist,
  type MerchantRoom,
  type MerchantRoomConflict,
} from "@/lib/merchantRooms";
import "./merchant-room-editor.css";

export interface MerchantRoomMeta {
  id: string | null;
  version: number;
  status: MerchantRoom["status"];
  publishedVersion: number | null;
  draftVersion: number | null;
  title: string;
  description: string;
  furnishing: "full" | "partial";
  roomType: RoomType;
}
export type MerchantPiece = {
  instanceId: string;
  name: string;
  state: "ready" | "loading" | "error";
};
type SaveState = "saved" | "dirty" | "saving" | "error";

const ROOMS_HREF = "/merchant?tab=rooms";
const stamp = (design: RoomDesign | null, meta: MerchantRoomMeta, cover: string | null) =>
  JSON.stringify([
    design?.updatedAt,
    meta.title,
    meta.description,
    meta.furnishing,
    meta.roomType,
    cover?.length ?? 0,
  ]);
const metaFrom = (room: MerchantRoom, title?: string): MerchantRoomMeta => ({
  id: room.id,
  version: room.version,
  status: room.status,
  publishedVersion: room.publishedVersion,
  draftVersion: room.draftVersion,
  title: title ?? room.title,
  description: room.description,
  furnishing: room.furnishing,
  roomType: room.roomType,
});

/** «Ноорог · v7», «Нийтэлсэн · v8» (with a pending draft: «Нийтэлсэн · v8 · ноорог v9»). */
export function merchantStatusLabel(meta: MerchantRoomMeta) {
  if (!meta.id) return "Шинэ ноорог";
  if (meta.status === "published")
    return meta.draftVersion
      ? `Нийтэлсэн · v${meta.publishedVersion ?? meta.version} · ноорог v${meta.draftVersion}`
      : `Нийтэлсэн · v${meta.publishedVersion ?? meta.version}`;
  if (meta.status === "archived") return `Архивласан · v${meta.version}`;
  return `Ноорог · v${meta.version}`;
}

/**
 * C3: the planner opened with `?merchantRoom=<id|new>` edits a store's own
 * room. Saving writes a draft; publishing replaces the gallery version.
 */
export function useMerchantRoomEditor(loadTemplate: (design: RoomDesign) => string) {
  const owner = useAuth((state) => state.user?.id);
  const role = useAuth((state) => state.role);
  const [requested, setRequested] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [store, setStore] = useState<{ id: string; name: string } | null>(null);
  const [meta, setMeta] = useState<MerchantRoomMeta | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState("");
  const [conflict, setConflict] = useState<MerchantRoomConflict | null>(null);
  const saved = useRef("");
  const designId = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setRequested(new URLSearchParams(window.location.search).get("merchantRoom"));
  }, []);
  const active = !!requested;

  const load = useCallback(
    async (id: string, signal?: AbortSignal) => {
      if (!owner) return;
      const response = await authFetch(`/api/merchant/room-templates?id=${id}`, { signal }, owner);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (signal?.aborted) return;
      designId.current = loadTemplate(data.template.design);
      const next = metaFrom(data.room, data.template.title);
      setMeta(next);
      setCover(data.template.previewImage || null);
      saved.current = stamp(useDesigns.getState().current, next, data.template.previewImage || null);
      setSaveState("saved");
      setConflict(null);
    },
    [owner, loadTemplate],
  );

  useEffect(() => {
    if (!requested) return;
    if (role !== "merchant" || !owner) {
      setError("Өрөө засахын тулд дэлгүүрийн эрхээр нэвтэрнэ үү.");
      return;
    }
    if (requested !== "new" && !templateId(requested)) {
      setError("Өрөөний дугаар буруу байна.");
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void (async () => {
      const response = await authFetch("/api/merchant/store", { signal: controller.signal }, owner);
      const data = await response.json();
      if (!response.ok || !data.store) throw new Error(data.error ?? "Дэлгүүрийн бүртгэл олдсонгүй.");
      if (controller.signal.aborted) return;
      setStore({ id: data.store.id, name: data.store.name });
      if (requested !== "new") return load(requested, controller.signal);
      // A new room starts locally; the first «Ноорог хадгалах» creates it.
      const params = new URLSearchParams(window.location.search);
      const type = params.get("type");
      const roomType = (type && Object.hasOwn(ROOM_TYPES, type) ? type : "living") as RoomType;
      const width = Number(params.get("w")), depth = Number(params.get("d"));
      const title = (params.get("title") ?? "").slice(0, 100) || "Шинэ өрөө";
      useDesigns.getState().createNew(
        "80",
        title,
        roomType,
        width > 0 && depth > 0 ? { width, depth, height: 2.7 } : undefined,
      );
      designId.current = useDesigns.getState().current?.id ?? null;
      const next: MerchantRoomMeta = {
        id: null,
        version: 0,
        status: "draft",
        publishedVersion: null,
        draftVersion: null,
        title,
        description: "",
        furnishing: "full",
        roomType,
      };
      setMeta(next);
      setSaveState("dirty");
    })()
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : "Өрөөг нээж чадсангүй.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [requested, role, owner, load]);

  // Any change to the room, its name, type, description or cover is unsaved.
  useEffect(() => {
    if (!active || !meta) return;
    const check = () => {
      if (saveState === "saving") return;
      const dirty = stamp(useDesigns.getState().current, meta, cover) !== saved.current;
      setSaveState((value) => (dirty ? (value === "error" ? "error" : "dirty") : "saved"));
    };
    check();
    return useDesigns.subscribe(check);
  }, [active, meta, cover, saveState]);

  const request = useCallback(
    async (body: Record<string, unknown>, method: "PUT" | "POST") => {
      const response = await authFetch(
        "/api/merchant/room-templates",
        { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
        owner,
      );
      const data = await response.json();
      if (response.status === 409 && data.conflict) {
        setConflict(data.conflict);
        return null;
      }
      if (!response.ok) throw new Error(data.error);
      return data as { room: MerchantRoom; template?: { title: string; previewImage: string } };
    },
    [owner],
  );

  /** «Ноорог хадгалах». `base` rebases onto another version after a conflict. */
  const save = useCallback(
    async (base?: number) => {
      const design = useDesigns.getState().current;
      if (!meta || !design || !owner) return null;
      setSaveState("saving");
      setSaveError("");
      try {
        const data = await request(
          {
            id: meta.id ?? undefined,
            version: base ?? meta.version,
            title: meta.title,
            description: meta.description,
            furnishing: meta.furnishing,
            roomType: meta.roomType,
            design,
            previewImage: cover ?? "",
          },
          "PUT",
        );
        if (!data) {
          setSaveState("dirty");
          return null;
        }
        const next = metaFrom(data.room, meta.title);
        setMeta(next);
        setConflict(null);
        saved.current = stamp(design, next, cover);
        setSaveState("saved");
        if (!meta.id) {
          const url = new URL(window.location.href);
          url.search = `?merchantRoom=${data.room.id}`;
          window.history.replaceState(null, "", url);
        }
        useDesigns.getState().saveCurrent();
        return next;
      } catch (reason) {
        setSaveState("error");
        setSaveError(reason instanceof Error ? reason.message : "Хадгалж чадсангүй.");
        return null;
      }
    },
    [meta, owner, cover, request],
  );

  const act = useCallback(
    async (action: "publish" | "unpublish") => {
      // Publishing always saves the current state first, so the cover matches.
      const current = action === "publish" || saveState !== "saved" ? await save() : meta;
      if (!current?.id) return null;
      try {
        const data = await request({ id: current.id, version: current.version, action }, "POST");
        if (!data) return null;
        const next = metaFrom(data.room, current.title);
        setMeta(next);
        saved.current = stamp(useDesigns.getState().current, next, cover);
        setSaveState("saved");
        return next;
      } catch (reason) {
        setSaveError(reason instanceof Error ? reason.message : "Үйлдэл амжилтгүй.");
        setSaveState("error");
        return null;
      }
    },
    [meta, save, saveState, request, cover],
  );

  /** Conflict: keep mine as the next draft, or load theirs and drop mine. */
  const resolve = useCallback(
    async (choice: "mine" | "theirs") => {
      if (!conflict || !meta?.id) return;
      if (choice === "mine") await save(conflict.version);
      else {
        setLoading(true);
        try {
          await load(meta.id);
        } finally {
          setLoading(false);
        }
      }
    },
    [conflict, meta, save, load],
  );

  return {
    active,
    loading,
    error,
    store,
    meta,
    setMeta: (patch: Partial<MerchantRoomMeta>) =>
      setMeta((value) => (value ? { ...value, ...patch } : value)),
    cover,
    setCover,
    saveState,
    saveError,
    conflict,
    dismissConflict: () => setConflict(null),
    save,
    publish: () => act("publish"),
    unpublish: () => act("unpublish"),
    resolve,
  };
}
export type MerchantRoomEditor = ReturnType<typeof useMerchantRoomEditor>;

export type MerchantPieceRow = { instanceId: string; name: string; has3d: boolean };
/** Live 3D load state of every placed piece; pieces without 3D cannot publish. */
export function useMerchantPieces(rows: MerchantPieceRow[]): MerchantPiece[] {
  const status = useRoomModelStatus((state) => state.byInstance);
  return rows.map((row) => {
    const value = status[row.instanceId];
    return {
      instanceId: row.instanceId,
      name: row.name,
      state: !row.has3d || value === "error"
        ? "error"
        : value === "ready"
          ? "ready"
          : "loading",
    };
  });
}

/** Cover can only come from a fully loaded room (C3: no half-loaded cover). */
export function coverBlocker(pieces: MerchantPiece[]) {
  const failed = pieces.filter((piece) => piece.state === "error").length;
  const loading = pieces.filter((piece) => piece.state === "loading").length;
  if (failed) return `${failed} загвар ачаалагдаагүй тул дуусаагүй зургийг cover болгохгүй.`;
  if (loading) return "Загварууд ачаалж дуусахыг хүлээж байна.";
  return "";
}

export function MerchantRoomHeader({
  editor,
  onPreview,
  onPublish,
}: {
  editor: MerchantRoomEditor;
  onPreview: () => void;
  onPublish: () => void;
}) {
  const meta = editor.meta!;
  const chip =
    editor.saveState === "saving"
      ? { tone: "checking", label: "Хадгалж байна…" }
      : editor.saveState === "error"
        ? { tone: "error", label: "Хадгалж чадсангүй" }
        : editor.saveState === "dirty"
          ? { tone: "dirty", label: "Хадгалаагүй өөрчлөлт" }
          : { tone: "saved", label: "Хадгалсан" };
  return (
    <header className="studio-header room-studio-header merchant-room-header">
      <Link href={ROOMS_HREF} className="merchant-room-back">
        <ArrowLeft size={17} aria-hidden="true" /> Өрөөнүүд
      </Link>
      <div className="room-project-name">
        <span>Merchant editor · {editor.store?.name}</span>
        <div>
          <input
            aria-label="Өрөөний нэр"
            maxLength={100}
            value={meta.title}
            onChange={(event) => editor.setMeta({ title: event.target.value })}
          />
          <span className="merchant-room-status" data-status={meta.id ? meta.status : "new"}>
            {merchantStatusLabel(meta)}
          </span>
          <span className="room-save-chip" data-tone={chip.tone} aria-live="polite" title={editor.saveError || undefined}>
            <i aria-hidden="true" />
            {chip.label}
            {editor.saveState === "error" && (
              <button type="button" onClick={() => void editor.save()}>
                Дахин оролдох
              </button>
            )}
          </span>
        </div>
      </div>
      <div className="studio-file-actions">
        <button type="button" onClick={onPreview}>
          <Eye size={18} aria-hidden="true" />
          <span>Урьдчилж харах</span>
        </button>
        <button
          type="button"
          disabled={editor.saveState === "saving"}
          onClick={() => void editor.save()}
        >
          <span>Ноорог хадгалах</span>
        </button>
        {meta.status === "published" && (
          <button type="button" onClick={() => void editor.unpublish()}>
            <span>Нийтлэлээс авах</span>
          </button>
        )}
        <button type="button" className="room-save-primary" onClick={onPublish}>
          <span>Нийтлэх…</span>
        </button>
      </div>
    </header>
  );
}

/** Third merchant tab: room settings shortcut and the gallery cover camera. */
export function MerchantRoomCameraPanel({
  design,
  cover,
  rows,
  onCover,
  onRoom,
}: {
  design: RoomDesign;
  cover: string | null;
  rows: MerchantPieceRow[];
  onCover: () => void;
  onRoom: () => void;
}) {
  const blocker = coverBlocker(useMerchantPieces(rows));
  return (
    <div className="merchant-room-camera">
      <section>
        <h3>Хэмжээ · Хана · Шал</h3>
        <p>
          {design.width} × {design.depth} м · өндөр {design.height} м
        </p>
        <button type="button" onClick={onRoom}>
          <PencilRuler size={16} aria-hidden="true" /> Өрөө ба материал засах
        </button>
      </section>
      <section aria-labelledby="merchant-cover-title">
        <h3 id="merchant-cover-title">Cover камер</h3>
        <div className="merchant-room-cover">
          {cover ? (
            <Image unoptimized src={cover} width={640} height={400} alt="Одоогийн cover" />
          ) : (
            <span>Cover сонгоогүй</span>
          )}
        </div>
        <p>
          {blocker ||
            (cover
              ? "Камераа тохируулаад дахин дарвал cover шинэчлэгдэнэ."
              : "Cover сонгоогүй. Камераа тохируулаад доорх товчийг дарна уу.")}
        </p>
        <button type="button" className="is-primary" disabled={!!blocker} onClick={onCover}>
          <Camera size={16} aria-hidden="true" /> Одоогийн харагдацыг cover болгох
        </button>
      </section>
    </div>
  );
}

function Modal({
  label,
  onClose,
  children,
  className = "",
}: {
  label: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>("input, button.is-primary:not(:disabled), button")?.focus();
    return () => opener?.focus?.();
  }, []);
  return (
    <div className="merchant-room-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`merchant-room-dialog ${className}`}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
      >
        <button type="button" className="merchant-room-dialog-close" aria-label="Хаах" onClick={onClose}>
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}

export function MerchantPublishDialog({
  editor,
  rows,
  onShow,
  onClose,
}: {
  editor: MerchantRoomEditor;
  rows: MerchantPieceRow[];
  onShow: (instanceId: string) => void;
  onClose: () => void;
}) {
  const meta = editor.meta!;
  const pieces = useMerchantPieces(rows);
  const [busy, setBusy] = useState(false);
  const checks = publishChecklist({
    title: meta.title,
    roomTypeLabel: ROOM_TYPES[meta.roomType]?.label ?? "",
    description: meta.description,
    pieces,
    coverReady: !!editor.cover && !coverBlocker(pieces),
  });
  const blocking = checks.filter((check) => check.blocking);
  return (
    <Modal label="Галерейд нийтлэх" onClose={onClose}>
      <h3>Галерейд нийтлэх</h3>
      <label>
        Нэр
        <input maxLength={100} value={meta.title} onChange={(event) => editor.setMeta({ title: event.target.value })} />
      </label>
      <label>
        Өрөөний төрөл
        <select value={meta.roomType} onChange={(event) => editor.setMeta({ roomType: event.target.value as RoomType })}>
          {Object.entries(ROOM_TYPES)
            .filter(([id]) => id !== "kitchen")
            .map(([id, type]) => (
              <option key={id} value={id}>
                {type.label}
              </option>
            ))}
        </select>
      </label>
      <label>
        Тайлбар (заавал биш)
        <textarea
          maxLength={500}
          rows={3}
          value={meta.description}
          onChange={(event) => editor.setMeta({ description: event.target.value })}
        />
      </label>
      <h4>Нийтлэхэд бэлэн эсэх</h4>
      <ul className="merchant-room-checks">
        {checks.map((check) => (
          <li key={check.id} data-ok={check.ok} data-blocking={check.blocking}>
            <span aria-hidden="true">{check.ok ? <Check size={15} /> : <AlertTriangle size={15} />}</span>
            <div>
              <strong>{check.title}</strong>
              <small>{check.note}</small>
            </div>
            {check.showInstanceId && (
              <button
                type="button"
                onClick={() => {
                  onShow(check.showInstanceId!);
                  onClose();
                }}
              >
                Харуулах
              </button>
            )}
          </li>
        ))}
      </ul>
      {editor.saveError && <p className="merchant-room-error" role="alert">{editor.saveError}</p>}
      <div className="merchant-room-dialog-actions">
        <button type="button" onClick={onClose}>
          Болих
        </button>
        <button
          type="button"
          className="is-primary"
          disabled={busy || blocking.length > 0}
          aria-describedby={blocking.length ? "merchant-publish-reason" : undefined}
          onClick={async () => {
            setBusy(true);
            const done = await editor.publish();
            setBusy(false);
            if (done) onClose();
          }}
        >
          {busy ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Нийтэлж байна…
            </>
          ) : (
            "Хадгалаад нийтлэх"
          )}
        </button>
      </div>
      {blocking.length > 0 && (
        <p id="merchant-publish-reason" className="merchant-room-reason">
          Нийтлэх боломжгүй: {blocking.map((check) => check.title).join(", ")}
        </p>
      )}
    </Modal>
  );
}

/** Never overwrite another person's version without an explicit choice. */
export function MerchantConflictDialog({ editor }: { editor: MerchantRoomEditor }) {
  const conflict = editor.conflict!;
  const time = new Date(conflict.updatedAt);
  const at = Number.isNaN(time.getTime())
    ? ""
    : `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}-д `;
  return (
    <Modal label="Өөр хүн шинэ хувилбар хадгалсан байна" onClose={editor.dismissConflict} className="is-conflict">
      <AlertTriangle size={24} aria-hidden="true" />
      <h3>Өөр хүн шинэ хувилбар хадгалсан байна</h3>
      <p>
        Энэ өрөөг {at}
        <strong>v{conflict.version}</strong> болгон хадгалсан. Таны өөрчлөлт v{editor.meta?.version} дээр
        суурилсан тул шууд дарж бичихгүй.
      </p>
      <div className="merchant-room-conflict-actions">
        <button type="button" className="is-primary" onClick={() => void editor.resolve("mine")}>
          Миний өөрчлөлтийг шинэ ноорог болгох
        </button>
        <button type="button" className="is-danger" onClick={() => void editor.resolve("theirs")}>
          v{conflict.version}-ийг ачаалах (миний өөрчлөлт устна)
        </button>
        <button type="button" onClick={editor.dismissConflict}>
          Болих
        </button>
      </div>
    </Modal>
  );
}

/** What the gallery card will show; an incomplete room never shows a cover. */
export function MerchantRoomPreview({
  editor,
  design,
  rows,
  onClose,
}: {
  editor: MerchantRoomEditor;
  design: RoomDesign;
  rows: MerchantPieceRow[];
  onClose: () => void;
}) {
  const meta = editor.meta!;
  const pieces = useMerchantPieces(rows);
  const blocker = coverBlocker(pieces);
  const ready = pieces.filter((piece) => piece.state === "ready").length;
  return (
    <Modal label="Галерейд ингэж харагдана" onClose={onClose}>
      <small>Галерейд ингэж харагдана</small>
      <div className="merchant-room-cover is-large">
        {editor.cover && !blocker ? (
          <Image unoptimized src={editor.cover} width={768} height={480} alt={`${meta.title} — cover`} />
        ) : (
          <div className="merchant-room-cover-missing">
            <strong>Cover бэлэн биш</strong>
            <span>{blocker || "«Өрөө ба камер» хэсгээс cover сонгоно уу."}</span>
          </div>
        )}
      </div>
      <h3>{meta.title}</h3>
      <p>
        {[
          ROOM_TYPES[meta.roomType]?.label,
          `${Math.round(design.width * design.depth)} м²`,
          templateFootprint(design),
          `${ready} тавилга`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <p>{editor.store?.name}</p>
      <p className="merchant-room-reason">
        {meta.status === "published" && editor.saveState === "saved" && !meta.draftVersion
          ? "Хэрэглэгчид одоо энэ хувилбарыг харж байна."
          : "Нийтлэх хүртэл хэрэглэгчид харагдахгүй."}
      </p>
    </Modal>
  );
}
