"use client";

import { useEffect, useRef } from "react";
import { Check, CircleAlert, ImageOff, LoaderCircle, Plus, X } from "lucide-react";
import { useKitchens } from "@/store/kitchens";
import { kitchenRoomFit, type KitchenFootprint } from "@/lib/kitchenRoomChoice";
import type { SavedKitchen } from "@/lib/kitchenAssembly";

const size = (room: { width: number; depth: number; height: number }) =>
  `${room.width} × ${room.depth} × ${room.height} мм`;

/**
 * "Try in the kitchen planner" first asks where: a fresh room sized for the
 * design, or one of the buyer's own kitchen rooms, marked by whether it fits.
 */
export function KitchenRoomPicker({
  footprint,
  busy,
  error,
  onClose,
  onNewRoom,
  onRoom,
}: {
  footprint: KitchenFootprint;
  busy: string | null;
  error: string;
  onClose: () => void;
  onNewRoom: () => void;
  onRoom: (room: SavedKitchen) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const items = useKitchens((state) => state.items);
  const owner = useKitchens((state) => state.owner);
  const loading = useKitchens((state) => state.loading);
  const loaded = useKitchens((state) => state.loaded);
  const libraryError = useKitchens((state) => state.error);
  const refresh = useKitchens((state) => state.refresh);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  useEffect(() => {
    if (owner && !loaded && !loading) void refresh();
  }, [owner, loaded, loading, refresh]);

  // Marketplace copies are someone else's room; only the buyer's own count.
  const rooms = items
    .filter((item) => !item.sourceMarketplaceDesignId)
    .map((item) => ({ item, fit: kitchenRoomFit(footprint, item.design.room) }))
    .sort((a, b) => Number(b.fit.fits) - Number(a.fit.fits));

  return (
    <dialog
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      aria-labelledby="kitchen-room-picker-title"
      className="m-auto max-h-[90dvh] w-[min(760px,95vw)] overflow-y-auto rounded-2xl bg-white p-5 backdrop:bg-black/50"
    >
      <header className="mb-1 flex items-center justify-between gap-3">
        <h2 id="kitchen-room-picker-title" className="text-lg font-semibold">
          Аль өрөөнд туршиж үзэх вэ?
        </h2>
        <button
          type="button"
          className="btn-ghost"
          aria-label="Цонх хаах"
          disabled={!!busy}
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      <p className="mb-4 text-sm text-black/60">
        Загварын гадна хэмжээ: {footprint.widthMm} × {footprint.depthMm} ×{" "}
        {footprint.heightMm} мм
      </p>

      <button
        type="button"
        className="mb-5 flex w-full items-center gap-3 rounded-xl border border-black/15 p-4 text-left hover:border-[var(--site-accent)] disabled:opacity-60"
        disabled={!!busy}
        onClick={onNewRoom}
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--site-accent)] text-white">
          {busy === "new" ? <LoaderCircle className="animate-spin" size={20} /> : <Plus size={20} />}
        </span>
        <span>
          <strong className="block">Шинэ өрөө үүсгэх</strong>
          <span className="text-sm text-black/60">
            Загварт тохирсон хэмжээтэй өрөөнд нээнэ
          </span>
        </span>
      </button>

      <h3 className="mb-2 text-sm font-semibold">Миний өрөөнүүд</h3>
      {loading && !rooms.length ? (
        <p className="flex items-center gap-2 text-sm text-black/60" role="status">
          <LoaderCircle className="animate-spin" size={15} /> Өрөөнүүдийг ачаалж байна…
        </p>
      ) : libraryError && !rooms.length ? (
        <p className="text-sm text-red-700" role="alert">
          {libraryError}{" "}
          <button type="button" className="underline" onClick={() => void refresh()}>
            Дахин оролдох
          </button>
        </p>
      ) : !rooms.length ? (
        <p className="text-sm text-black/60">
          Өмнө үүсгэсэн гал тогооны өрөө алга байна.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {rooms.map(({ item, fit }) => (
            <li key={item.id}>
              <button
                type="button"
                className={`w-full overflow-hidden rounded-xl border-2 text-left transition disabled:cursor-not-allowed ${
                  fit.fits
                    ? "border-emerald-500 hover:shadow-md"
                    : "border-red-400 opacity-75"
                }`}
                disabled={!fit.fits || !!busy}
                aria-describedby={`room-fit-${item.id}`}
                onClick={() => onRoom(item)}
              >
                <span className="relative block aspect-[16/9] bg-black/5">
                  {item.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumbnailUrl}
                      alt=""
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="grid size-full place-items-center text-black/30">
                      <ImageOff size={28} />
                    </span>
                  )}
                  {busy === item.id && (
                    <span className="absolute inset-0 grid place-items-center bg-white/70">
                      <LoaderCircle className="animate-spin" size={24} />
                    </span>
                  )}
                </span>
                <span className="block p-3">
                  <strong className="block truncate">{item.name}</strong>
                  <span className="block text-xs text-black/60">
                    {size(item.design.room)}
                  </span>
                  <span
                    id={`room-fit-${item.id}`}
                    className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      fit.fits
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {fit.fits ? <Check size={13} /> : <CircleAlert size={13} />}
                    {fit.message}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {error ? (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </dialog>
  );
}
