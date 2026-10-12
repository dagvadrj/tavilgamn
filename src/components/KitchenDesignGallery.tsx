"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Expand,
  ImageOff,
  LoaderCircle,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  isKitchenAiMedia,
  kitchenGalleryMedia,
  kitchenMediaLabel,
  type KitchenDesignMedia,
} from "@/lib/kitchenDesignMedia";

export function KitchenDesignGallery({
  media,
  title,
  activeMediaId,
  pendingMediaId,
  onRemove,
  removeDisabled,
}: {
  media: KitchenDesignMedia[];
  title: string;
  activeMediaId?: string | null;
  pendingMediaId?: string | null;
  onRemove?: (media: KitchenDesignMedia) => void;
  removeDisabled?: (media: KitchenDesignMedia) => boolean;
}) {
  const items = kitchenGalleryMedia(media);
  const [selectedId, setSelectedId] = useState(activeMediaId ?? items[0]?.id);
  useEffect(() => {
    if (activeMediaId) setSelectedId(activeMediaId);
  }, [activeMediaId]);
  const dialog = useRef<HTMLDialogElement>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const index = Math.max(
    0,
    items.findIndex((item) => item.id === selectedId),
  );
  const current = items[index];
  const move = (step: number) =>
    setSelectedId(items[(index + step + items.length) % items.length]?.id);
  if (!current)
    return (
      <div className="kd-gallery-empty">
        <ImageOff size={32} />
        <p>Зураг хараахан нэмэгдээгүй</p>
      </div>
    );

  return (
    <section
      className="kd-gallery"
      aria-label="Загварын зургууд"
      aria-busy={Boolean(pendingMediaId)}
    >
      <div className="kd-gallery-stage">
        <Image
          key={current.id}
          src={current.url}
          alt={current.altText || title}
          fill
          priority
          unoptimized={current.url.startsWith("blob:")}
          sizes="(max-width: 900px) 100vw, 65vw"
          className="kd-gallery-image"
        />
        <span className="kd-gallery-label">
          {current.id === pendingMediaId ? (
            <>
              <LoaderCircle size={13} className="animate-spin" />
              Оруулж байна…
            </>
          ) : (
            <>
              {isKitchenAiMedia(current) && <Sparkles size={13} />}
              {kitchenMediaLabel(current)}
            </>
          )}
        </span>
        <button
          ref={expandButton}
          className="kd-gallery-expand"
          type="button"
          aria-label="Зургийг томруулж харах"
          onClick={() => dialog.current?.showModal()}
        >
          <Expand size={17} />
        </button>
        {(items.length > 1 || onRemove) && (
          <span className="kd-gallery-count">
            {index + 1} / {items.length}
          </span>
        )}
      </div>
      {(items.length > 1 || onRemove) && (
        <div className="kd-gallery-thumbnails" aria-label="Зураг сонгох">
          {items.map((item, i) => (
            <div className="kd-thumbnail-item" key={item.id}>
              <button
                className="kd-thumbnail-select"
                type="button"
                aria-label={`${kitchenMediaLabel(item)} ${i + 1}`}
                aria-pressed={item.id === current.id}
                onClick={() => setSelectedId(item.id)}
              >
                <span className="kd-thumbnail-image">
                  <Image
                    src={item.url}
                    alt=""
                    fill
                    sizes="96px"
                    unoptimized={item.url.startsWith("blob:")}
                  />
                </span>
                <span>{kitchenMediaLabel(item)}</span>
              </button>
              {onRemove && item.id !== pendingMediaId && (
                <button
                  className="kd-thumbnail-delete"
                  type="button"
                  aria-label={`${kitchenMediaLabel(item)} ${i + 1} устгах`}
                  title={
                    removeDisabled?.(item)
                      ? "Одоо устгах боломжгүй"
                      : "Зураг устгах"
                  }
                  disabled={removeDisabled?.(item)}
                  onClick={() => onRemove(item)}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="kd-gallery-note">
        {isKitchenAiMedia(current)
          ? "AI дүрслэл. Эцсийн өнгө, материалыг үйлдвэрлэгчтэй тохиролцоно."
          : "Зургийг томруулан дэлгэрэнгүй хараарай."}
      </p>
      <dialog
        ref={dialog}
        onClose={() => expandButton.current?.focus()}
        className="kd-image-dialog"
        aria-label={`${title} — зураг`}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
        onKeyDown={(event) => {
          if (items.length < 2) return;
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            move(event.key === "ArrowLeft" ? -1 : 1);
          }
        }}
      >
        <div className="kd-lightbox">
          <div className="kd-lightbox-heading">
            <span>
              {kitchenMediaLabel(current)} · {index + 1}/{items.length}
            </span>
            <button
              type="button"
              aria-label="Хаах"
              onClick={() => dialog.current?.close()}
            >
              <X size={22} />
            </button>
          </div>
          <div className="kd-lightbox-image">
            <Image
              src={current.url}
              alt={current.altText || title}
              fill
              unoptimized={current.url.startsWith("blob:")}
              sizes="95vw"
            />
          </div>
          {items.length > 1 && (
            <div className="kd-lightbox-controls">
              <button
                type="button"
                aria-label="Өмнөх зураг"
                onClick={() => move(-1)}
              >
                <ChevronLeft size={22} />
              </button>
              <button
                type="button"
                aria-label="Дараах зураг"
                onClick={() => move(1)}
              >
                <ChevronRight size={22} />
              </button>
            </div>
          )}
        </div>
      </dialog>
    </section>
  );
}
