"use client";
import { useEffect, useRef, useState } from "react";
import type { RoomType, RoomWall } from "@/lib/types";
import { ROOM_TYPES, ROOM_WALLS } from "@/lib/roomGeometry";
import type { AddRoomOptions } from "@/lib/addRoomOptions";

export function RoomAddDialog({
  type,
  onAdd,
  onClose,
}: {
  type: RoomType;
  onAdd: (type: RoomType, options: AddRoomOptions) => void;
  onClose: () => void;
}) {
  const preset = ROOM_TYPES[type];
  const [options, setOptions] = useState<AddRoomOptions>({
    name: preset.label,
    width: preset.width,
    depth: preset.depth,
    height: 2.7,
    door: true,
    window: false,
    doorWall: "south",
    windowWall: "north",
  });
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const wallSelect = (key: "doorWall" | "windowWall") => (
    <select
      className="w-full rounded-lg border p-2"
      aria-label={key === "doorWall" ? "Хаалганы хана" : "Цонхны хана"}
      value={options[key]}
      onChange={(e) =>
        setOptions({ ...options, [key]: e.target.value as RoomWall })
      }
    >
      {Object.entries(ROOM_WALLS).map(([wall, label]) => (
        <option key={wall} value={wall}>
          {label}
        </option>
      ))}
    </select>
  );
  return (
    <dialog
      ref={dialog}
      onCancel={onClose}
      className="w-[min(94vw,480px)] rounded-2xl p-6 text-[#293C32] shadow-xl backdrop:bg-black/40"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          try {
            onAdd(type, options);
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Өрөө нэмэхэд алдаа гарлаа.",
            );
          }
        }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Өрөө нэмэх</h2>
          <button type="button" aria-label="Хаах" onClick={onClose}>
            ✕
          </button>
        </div>
        <label className="mb-4 block">
          Өрөөний нэр
          <input
            autoFocus
            className="mt-1 w-full rounded-lg border p-2"
            maxLength={80}
            value={options.name}
            onChange={(e) => setOptions({ ...options, name: e.target.value })}
          />
        </label>
        <div className="mb-4 grid grid-cols-3 gap-3">
          {(["width", "depth", "height"] as const).map((key, i) => (
            <label key={key}>
              {["Өргөн (м)", "Урт (м)", "Өндөр (м)"][i]}
              <input
                required
                className="mt-1 w-full rounded-lg border p-2"
                type="number"
                min={key === "height" ? 2.4 : 1}
                max={key === "height" ? 3 : 20}
                step="0.01"
                value={options[key]}
                onChange={(e) =>
                  setOptions({ ...options, [key]: Number(e.target.value) })
                }
              />
            </label>
          ))}
        </div>
        <div className="mb-4 grid grid-cols-2 gap-4">
          <label>
            Хаалга
            <select
              className="my-2 w-full rounded-lg border p-2"
              value={String(options.door)}
              onChange={(e) =>
                setOptions({ ...options, door: e.target.value === "true" })
              }
            >
              <option value="true">Хаалгатай</option>
              <option value="false">Хаалгагүй</option>
            </select>
            {options.door && wallSelect("doorWall")}
          </label>
          <label>
            Цонх
            <select
              className="my-2 w-full rounded-lg border p-2"
              value={String(options.window)}
              onChange={(e) =>
                setOptions({ ...options, window: e.target.value === "true" })
              }
            >
              <option value="true">Цонхтой</option>
              <option value="false">Цонхгүй</option>
            </select>
            {options.window && wallSelect("windowWall")}
          </label>
        </div>
        <p className="mb-4 text-sm text-gray-600">
          Камерын цэг автоматаар нэмэгдэнэ. Өрөөнүүдийг хананд нь нийлүүлэхэд
          хаалгатай холбоос эсвэл хаалгагүй нээлттэй гарц үүснэ. Цонхыг гадна
          хананд байрлуулна.
        </p>
        {error && (
          <p role="alert" className="mb-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Цуцлах
          </button>
          <button type="submit" className="btn-primary">
            Өрөө нэмэх
          </button>
        </div>
      </form>
    </dialog>
  );
}
