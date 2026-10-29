"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, ArrowRight, SearchX, X } from "lucide-react";
import type { RoomDesign, RoomType } from "@/lib/types";
import {
  templateFootprint,
  type RoomTemplate,
  type RoomTemplateCard,
} from "@/lib/roomTemplates";
import { ROOM_TYPES } from "@/lib/roomGeometry";

export interface GalleryStore {
  id: string;
  name: string;
  image: string;
  roomCount: number;
}
export interface GalleryFilters {
  store: string;
  type: RoomType | "";
  furnishing: "" | "full" | "partial";
}
const NO_FILTERS: GalleryFilters = { store: "", type: "", furnishing: "" };
const FURNISHING = [
  { id: "", label: "Бүгд" },
  { id: "full", label: "Бүрэн" },
  { id: "partial", label: "Хэсэгчлэн" },
] as const;

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toLocaleUpperCase("mn"))
    .join("");

export const furnishingLabel = (card: RoomTemplateCard) =>
  card.kind === "empty"
    ? "Тавилгагүй"
    : card.furnishing === "full"
      ? "Бүрэн"
      : "Хэсэгчлэн";

/** «Зочны өрөө · 20 м² · 5 × 4 м». */
export const templateMeta = (card: RoomTemplateCard) =>
  [
    ROOM_TYPES[card.roomType]?.label,
    `${Math.round(card.area)} м²`,
    templateFootprint(card),
  ]
    .filter(Boolean)
    .join(" · ");

/**
 * C1: rooms grouped by the store that furnished them. Store owners come first;
 * rooms without a store form «Платформын загварууд» at the end.
 */
export function groupTemplates(
  cards: RoomTemplateCard[],
  stores: GalleryStore[],
) {
  const byId = new Map(stores.map((store) => [store.id, store]));
  const groups: {
    key: string;
    store: GalleryStore | null;
    cards: RoomTemplateCard[];
  }[] = [];
  for (const card of cards) {
    const store = card.storeId ? (byId.get(card.storeId) ?? null) : null;
    const key = store?.id ?? "platform";
    let group = groups.find((item) => item.key === key);
    if (!group) groups.push((group = { key, store, cards: [] }));
    group.cards.push(card);
  }
  return [
    ...groups.filter((group) => group.store),
    ...groups.filter((group) => !group.store),
  ];
}

export function galleryQuery(filters: GalleryFilters, offset: number) {
  const params = new URLSearchParams();
  if (filters.store) params.set("store", filters.store);
  if (filters.type) params.set("type", filters.type);
  if (filters.furnishing) params.set("furnishing", filters.furnishing);
  if (offset) params.set("offset", String(offset));
  const query = params.toString();
  return `/api/room-templates${query ? `?${query}` : ""}`;
}

type Page = {
  templates: RoomTemplateCard[];
  stores?: GalleryStore[];
  hasMore?: boolean;
  nextOffset?: number;
};

export function RoomTemplateShowcase({
  onTemplate,
  disabled = false,
}: {
  onTemplate: (design: RoomDesign) => void;
  disabled?: boolean;
}) {
  const [filters, setFilters] = useState<GalleryFilters>(NO_FILTERS);
  const [cards, setCards] = useState<RoomTemplateCard[] | null>(null);
  const [stores, setStores] = useState<GalleryStore[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [status, setStatus] = useState<"loading" | "more" | "error" | "ready">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  const [offset, setOffset] = useState(0);
  const [opening, setOpening] = useState<RoomTemplateCard | null>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    setStatus(offset ? "more" : "loading");
    if (!offset) setCards(null);
    void fetch(galleryQuery(filters, offset), {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const data = (await response.json()) as Page & { error?: string };
        if (!response.ok) throw new Error(data.error);
        if (controller.signal.aborted) return;
        setCards((previous) =>
          offset && previous ? [...previous, ...data.templates] : data.templates,
        );
        if (data.stores) setStores(data.stores);
        setNext(data.hasMore ? (data.nextOffset ?? null) : null);
        setStatus("ready");
      })
      .catch(() => {
        // The filters stay as chosen; «Дахин оролдох» repeats this request.
        if (!controller.signal.aborted) setStatus("error");
      });
    return () => controller.abort();
  }, [filters, offset, attempt]);

  const change = useCallback((patch: Partial<GalleryFilters>) => {
    setOffset(0);
    setFilters((previous) => ({ ...previous, ...patch }));
  }, []);
  const filtered = !!(filters.store || filters.type || filters.furnishing);
  const storeName = (id: string | null | undefined) =>
    id ? (stores.find((store) => store.id === id)?.name ?? "Дэлгүүр") : "Платформын";
  const groups = cards ? groupTemplates(cards, stores) : [];
  // No published rooms at all: filters and a «nothing matches» message would
  // only suggest the visitor did something wrong, so the section stays hidden.
  if (status === "ready" && !filtered && cards && !cards.length) return null;

  return (
    <section
      className="room-showcase"
      aria-labelledby="furnished-room-heading"
      aria-busy={status === "loading"}
    >
      <header className="room-showcase-head">
        <div>
          <h2 id="furnished-room-heading">Тохижуулсан өрөөнүүд</h2>
          <p>
            Дэлгүүрүүдийн бэлдсэн бодит 3D өрөөг нээгээд өөрийн хуулбар дээр
            тавилгаа сольж, хэмжээгээ тохируулаарай.
          </p>
        </div>
        {cards && (
          <span className="room-showcase-count" role="status">
            {cards.length}
            {next !== null ? "+" : ""} өрөө
          </span>
        )}
      </header>
      <div className="room-showcase-filters">
        <label>
          Дэлгүүр
          <select
            value={filters.store}
            onChange={(event) => change({ store: event.target.value })}
          >
            <option value="">Бүх дэлгүүр</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
            <option value="platform">Платформын загвар</option>
          </select>
        </label>
        <div role="group" aria-label="Өрөөний төрөл">
          <span>Өрөөний төрөл</span>
          {[["", "Бүгд"] as const, ...Object.entries(ROOM_TYPES).map(([id, type]) => [id, type.label] as const)].map(
            ([id, label]) => (
              <button
                key={id || "all"}
                type="button"
                aria-pressed={filters.type === id}
                onClick={() => change({ type: id as GalleryFilters["type"] })}
              >
                {label}
              </button>
            ),
          )}
        </div>
        <div role="group" aria-label="Тохижилт">
          <span>Тохижилт</span>
          {FURNISHING.map((item) => (
            <button
              key={item.id || "all"}
              type="button"
              aria-pressed={filters.furnishing === item.id}
              onClick={() => change({ furnishing: item.id })}
            >
              {item.label}
            </button>
          ))}
        </div>
        {filtered && (
          <button
            type="button"
            className="room-showcase-clear"
            onClick={() => change(NO_FILTERS)}
          >
            Шүүлтүүр цэвэрлэх
          </button>
        )}
      </div>

      {status === "error" && (
        <div className="room-showcase-state is-error" role="alert">
          <AlertTriangle size={22} aria-hidden="true" />
          <strong>Галерей ачаалагдсангүй</strong>
          <p>Сүлжээний алдаа гарлаа. Таны шүүлтүүр хадгалагдсан.</p>
          <button type="button" onClick={() => setAttempt((value) => value + 1)}>
            Дахин оролдох
          </button>
        </div>
      )}
      {status === "loading" && (
        <div className="room-showcase-skeleton" role="status" aria-label="Өрөөнүүдийг ачаалж байна…">
          {[0, 1, 2, 3].map((index) => (
            <span key={index} aria-hidden="true" />
          ))}
        </div>
      )}
      {cards && !cards.length && status === "ready" && (
        <div className="room-showcase-state" role="status">
          <SearchX size={22} aria-hidden="true" />
          <strong>Шүүлтүүрт тохирох өрөө алга</strong>
          <p>
            {filters.store && filters.store !== "platform"
              ? `${storeName(filters.store)}-д энэ сонголтод тохирох өрөө алга. Өрөөний төрөл эсвэл тохижилтын шүүлтүүрээ өөрчилж үзнэ үү.`
              : "Өрөөний төрөл эсвэл тохижилтын шүүлтүүрээ өөрчилж үзнэ үү."}
          </p>
          <button type="button" onClick={() => change(NO_FILTERS)}>
            Шүүлтүүр цэвэрлэх
          </button>
        </div>
      )}

      {groups.map((group) => (
        <section
          key={group.key}
          className="room-showcase-group"
          aria-label={group.store?.name ?? "Платформын загварууд"}
        >
          <header>
            <span className="room-showcase-logo" aria-hidden="true">
              {group.store?.image ? (
                <Image unoptimized src={group.store.image} width={44} height={44} alt="" />
              ) : (
                initials(group.store?.name ?? "Платформ")
              )}
            </span>
            <div>
              <strong>{group.store?.name ?? "Платформын загварууд"}</strong>
              <small>
                {group.store
                  ? `${group.store.roomCount} тохижуулсан өрөө`
                  : "Дэлгүүргүй хуучин загварууд. Тавилгагүй эсвэл хэсэгчлэн тохижсон эхлэлийн өрөө."}
              </small>
            </div>
            {group.store && (
              <Link href={`/catalog/stores/${encodeURIComponent(group.store.id)}`}>
                Дэлгүүр үзэх <ArrowRight size={15} aria-hidden="true" />
              </Link>
            )}
          </header>
          <div className="room-showcase-grid">
            {group.cards.map((card) => (
              <article key={card.id} className="room-showcase-card">
                <span className="room-showcase-image">
                  <Image unoptimized src={card.previewImage} width={768} height={480} alt={`${card.title} — урьдчилсан харагдац`} />
                  <span className="room-showcase-badge" data-kind={card.kind === "empty" ? "empty" : card.furnishing}>
                    {furnishingLabel(card)}
                  </span>
                </span>
                <div>
                  <strong>{card.title}</strong>
                  <small>{templateMeta(card)}</small>
                  <small>
                    {card.pieceCount ?? 0} тавилга · {group.store?.name ?? "Платформын загвар"}
                  </small>
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`${card.title} нээх`}
                  onClick={() => setOpening(card)}
                >
                  Нээх
                </button>
              </article>
            ))}
          </div>
        </section>
      ))}

      {cards && cards.length > 0 && (
        <div className="room-showcase-more">
          {next !== null ? (
            <button
              type="button"
              disabled={status === "more"}
              onClick={() => setOffset(next)}
            >
              {status === "more" ? "Ачаалж байна…" : "Цааш ачаалах"}
            </button>
          ) : (
            status === "ready" && <p>Бүх өрөөг харууллаа</p>
          )}
        </div>
      )}

      {opening && (
        <TemplateCopyDialog
          card={opening}
          owner={opening.storeId ? storeName(opening.storeId) : "Платформын"}
          onClose={() => setOpening(null)}
          onOpen={onTemplate}
        />
      )}
    </section>
  );
}

/** C1: opening always works on the shopper's own copy; nothing goes to the cart. */
export function TemplateCopyDialog({
  card,
  owner,
  onClose,
  onOpen,
}: {
  card: RoomTemplateCard;
  owner: string;
  onClose: () => void;
  onOpen: (design: RoomDesign) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const confirm = useRef<HTMLButtonElement>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    confirm.current?.focus();
    return () => controller.current?.abort();
  }, []);
  async function open() {
    if (busy) return;
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/room-templates?id=${card.id}`, {
        cache: "no-store",
        signal: request.signal,
      });
      const data = (await response.json()) as {
        template?: RoomTemplate;
        error?: string;
      };
      if (!response.ok || !data.template)
        throw new Error(data.error ?? "Өрөөг нээж чадсангүй.");
      if (!request.signal.aborted) onOpen(data.template.design);
    } catch (reason) {
      if (!request.signal.aborted)
        setError(reason instanceof Error ? reason.message : "Өрөөг нээж чадсангүй.");
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  }
  return (
    <div className="room-showcase-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div
        className="room-showcase-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-copy-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
      >
        <button type="button" className="room-showcase-dialog-close" aria-label="Хаах" onClick={onClose}>
          <X size={18} />
        </button>
        <small>{owner === "Платформын" ? "Платформын загвар" : owner}</small>
        <h3 id="room-copy-title">{card.title}</h3>
        <p className="room-showcase-dialog-meta">{templateMeta(card)}</p>
        <p>
          Та энэ өрөөний <strong>өөрийн хуулбар</strong> дээр ажиллана.{" "}
          {owner === "Платформын" ? "Платформын" : `${owner}-ийн`} эх загвар
          өөрчлөгдөхгүй, таны өөрчлөлт зөвхөн таны «Миний загварууд»-д
          хадгалагдана.
        </p>
        <ul>
          <li>
            {card.pieceCount ?? 0} тавилга таны өрөөнд байрлана — сагсанд
            автоматаар орохгүй.
          </li>
          <li>Өрөөний хэмжээ, хана, шалыг чөлөөтэй өөрчилж болно.</li>
        </ul>
        {error && (
          <p className="room-showcase-dialog-error" role="alert">
            {error}
          </p>
        )}
        <div className="room-showcase-dialog-actions">
          <button type="button" onClick={onClose}>
            Болих
          </button>
          <button ref={confirm} type="button" className="is-primary" disabled={busy} onClick={() => void open()}>
            {busy ? "Нээж байна…" : "Хуулбар үүсгэж нээх"}
          </button>
        </div>
      </div>
    </div>
  );
}
