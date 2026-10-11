"use client";
import type { FurnishingOptions, FurnishingMode } from "@/lib/roomFurnishing";
import { useDesigns } from "@/store/designs";

export function RoomFurnishingPicker({
  value,
  onChange,
}: {
  value: FurnishingOptions;
  onChange: (patch: FurnishingOptions) => void;
}) {
  const furniture = useDesigns((s) => s.furniture);
  return (
    <fieldset className="my-4 rounded-xl border border-gray-200 p-3">
      <legend className="px-1 text-sm font-semibold">
        Өрөөг хэрхэн эхлүүлэх вэ?
      </legend>
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["empty", "Хоосон өрөө"],
            ["preset", "Бэлэн багц"],
            ["mine", "Миний тавилга"],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            aria-pressed={(value.furnishing ?? "empty") === mode}
            className={`rounded-lg border px-2 py-3 text-xs ${(value.furnishing ?? "empty") === mode ? "border-blue-600 bg-blue-50 text-blue-800" : "border-gray-200"}`}
            onClick={() =>
              onChange({
                furnishing: mode as FurnishingMode,
                furnitureIds: value.furnitureIds?.length
                  ? value.furnitureIds
                  : furniture.map((item) => item.id),
              })
            }
          >
            {label}
          </button>
        ))}
      </div>
      {value.furnishing === "preset" && (
        <p className="mt-3 text-xs text-gray-600">
          Өрөөний төрөл, хэмжээнд багтах каталоги дахь тавилгыг автоматаар
          байрлуулна. Дараа нь сольж, зөөж болно.
        </p>
      )}
      {value.furnishing === "mine" && (
        <div className="mt-3 space-y-2">
          {!furniture.length && (
            <p className="text-xs text-gray-600">
              Профайл дахь “Миний тавилга” хэсэгт тавилгаа бүртгэнэ үү. Өрөөнд
              нэмсэн тавилга мөн энд хадгалагдана.
            </p>
          )}
          {furniture.map((item) => (
            <label key={item.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={value.furnitureIds?.includes(item.id) ?? false}
                onChange={(event) =>
                  onChange({
                    furnitureIds: event.target.checked
                      ? [...(value.furnitureIds ?? []), item.id]
                      : value.furnitureIds?.filter((id) => id !== item.id),
                  })
                }
              />
              <span>
                {item.name}{" "}
                <small className="text-gray-500">
                  {Math.round(item.dimensions.w * 100)} ×{" "}
                  {Math.round(item.dimensions.d * 100)} см · {item.quantity} ш
                </small>
              </span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
