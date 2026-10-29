"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  Armchair,
  Copy,
  Focus,
  Loader2,
  Trash2,
} from "lucide-react";
import { useCart } from "@/store/cart";
import { useRoomModelStatus } from "@/store/roomModelStatus";
import type { Material } from "@/lib/types";

const ROW_STATE = {
  loading: "Ачаалж байна",
  swapping: "Хувилбар солиж байна",
  error: "Ачаалагдсангүй",
  ready: "Бэлэн",
} as const;

export interface RoomAddedRow {
  instanceId: string;
  productId: string;
  color: string;
  material: Material;
  name: string;
  /** Running number among instances of the same product. */
  number: number;
  image: string | null;
  meta: string;
  price: string;
  has3d: boolean;
  /** Kitchen assemblies are not cart products. */
  purchasable: boolean;
}

/**
 * Scene instances of the active room. Selecting a row never moves the camera;
 * «Төвлөрүүлэх» is the separate explicit camera action.
 */
export function RoomAddedList({
  rows,
  selected,
  room,
  summary,
  onRoom,
  onSelect,
  onFocus,
  onDuplicate,
  onRemove,
  onEdit,
  onAddFurniture,
  onTemplates,
}: {
  rows: RoomAddedRow[];
  selected: string | null;
  room: string;
  summary: string;
  onRoom: () => void;
  onSelect: (instanceId: string) => void;
  onFocus: () => void;
  onDuplicate: () => void;
  /** Removes one instance; also offered on a row whose model failed to load. */
  onRemove: (instanceId: string) => void;
  onEdit: () => void;
  onAddFurniture: () => void;
  /** Opens the ready-made rooms; shown only while the room is empty. */
  onTemplates: () => void;
}) {
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!selected) return;
    list.current
      ?.querySelector<HTMLElement>(`[data-instance="${CSS.escape(selected)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);
  return (
    <div className="room-added">
      <div className="room-panel-context">
        <div>
          <strong>{room}</strong>
          <span>{summary}</span>
        </div>
        <button type="button" onClick={onRoom}>
          Өрөө ба материал
        </button>
      </div>
      {rows.length ? (
        <>
          <p className="room-panel-hint">
            Мөр дээр дарвал бүтээгдэхүүний сонголт нээгдэнэ — камер
            хөдлөхгүй. Харахын тулд «Төвлөрүүлэх».
          </p>
          <ul
            ref={list}
            className="room-added-list"
            aria-label="Өрөөнд нэмсэн тавилга"
          >
            {rows.map((row) => (
              <AddedRow
                key={row.instanceId}
                row={row}
                selected={row.instanceId === selected}
                onSelect={() => onSelect(row.instanceId)}
                onFocus={onFocus}
                onDuplicate={onDuplicate}
                onRemove={() => onRemove(row.instanceId)}
                onEdit={onEdit}
              />
            ))}
          </ul>
        </>
      ) : (
        <div className="room-panel-empty">
          <strong>Өрөө хоосон байна</strong>
          <p>
            Каталогоос тавилга сонгож байрлуулах эсвэл бэлэн өрөөнөөс эхлээрэй.
          </p>
          <div className="room-panel-empty-actions">
            <button
              type="button"
              className="is-primary"
              onClick={onAddFurniture}
            >
              Тавилга нэмэх
            </button>
            <button type="button" onClick={onTemplates}>
              Бэлэн өрөө
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddedRow({
  row,
  selected,
  onSelect,
  onFocus,
  onDuplicate,
  onRemove,
  onEdit,
}: {
  row: RoomAddedRow;
  selected: boolean;
  onSelect: () => void;
  onFocus: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onEdit: () => void;
}) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const status = useRoomModelStatus(
    (state) => state.byInstance[row.instanceId],
  );
  const inCart = useCart(
    (state) =>
      state.items?.find(
        (item) =>
          item.productId === row.productId &&
          item.color === row.color &&
          item.material === row.material,
      )?.qty ?? 0,
  );
  const state = !row.has3d
    ? "ready"
    : status === "loading" || status === "swapping" || status === "error"
      ? status
      : "ready";
  const retry = () => useRoomModelStatus.getState().retry(row.instanceId);
  return (
    <li data-instance={row.instanceId} data-selected={selected || undefined}>
      <button
        type="button"
        className="room-added-row"
        aria-pressed={selected}
        onClick={onSelect}
      >
        <span className="room-added-thumb">
          {row.image && failedImage !== row.image ? (
            <Image
              src={row.image}
              alt=""
              width={56}
              height={56}
              unoptimized={row.image.startsWith("/api/")}
              onError={() => setFailedImage(row.image)}
            />
          ) : (
            <Armchair size={22} aria-hidden="true" />
          )}
        </span>
        <span className="room-added-text">
          <strong>
            {row.name} <small>#{row.number}</small>
          </strong>
          <span>{row.meta}</span>
          <span className="room-added-chips">
            <span className={`is-${state}`}>
              {state === "loading" || state === "swapping" ? (
                <Loader2
                  size={11}
                  className="animate-spin"
                  aria-hidden="true"
                />
              ) : null}
              {ROW_STATE[state]}
            </span>
            {row.purchasable && (
              <span className={inCart ? "is-cart" : "is-muted"}>
                {inCart ? `Сагсанд ${inCart}` : "Сагсанд ороогүй"}
              </span>
            )}
          </span>
        </span>
        <span className="room-added-price">{row.price}</span>
        {state === "loading" && (
          <span className="room-added-progress" aria-hidden="true" />
        )}
      </button>
      {state === "error" && (
        <div className="room-added-error" role="alert">
          <span>Загвар ачаалагдсангүй. Байрлал хадгалагдсан.</span>
          <button type="button" className="is-primary" onClick={retry}>
            Дахин оролдох
          </button>
          <button type="button" className="is-danger" onClick={onRemove}>
            Өрөөнөөс хасах
          </button>
        </div>
      )}
      {selected && (
        <div
          className="room-added-actions"
          role="group"
          aria-label={`${row.name} #${row.number}`}
        >
          <button type="button" onClick={onFocus}>
            <Focus size={15} aria-hidden="true" /> Төвлөрүүлэх
          </button>
          <button type="button" onClick={onDuplicate}>
            <Copy size={15} aria-hidden="true" /> Хуулбарлах
          </button>
          <button type="button" className="is-danger" onClick={onRemove}>
            <Trash2 size={15} aria-hidden="true" /> Устгах
          </button>
          <button type="button" className="is-primary" onClick={onEdit}>
            Засах <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      )}
    </li>
  );
}
