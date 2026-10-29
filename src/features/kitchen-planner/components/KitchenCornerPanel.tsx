"use client";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { ModularKitchen } from "@/lib/kitchenCabinets";
import {
  arrangeKitchenCorner,
  recommendKitchenCorner,
} from "@/lib/kitchenCornerLayout";
import { Plan } from "./PlannerPanels";
import "./kitchen-features.css";

export function KitchenCornerPanel({
  kitchen,
  disabled,
  onApply,
  onClose,
}: {
  kitchen: ModularKitchen;
  disabled: boolean;
  onApply: (next: ModularKitchen) => void;
  onClose: () => void;
}) {
  const count = kitchen.cabinets.filter((c) => c.type === "base").length;
  const [side, setSide] = useState<"left" | "right">(
    kitchen.cornerPlan?.side ??
      (kitchen.layout === "l-right" ? "right" : "left"),
  );
  const [clearanceMm, setClearance] = useState(
    kitchen.cornerPlan?.clearanceMm ?? 60,
  );
  const [mainCount, setMainCount] = useState<number | "auto">("auto");
  const result = useMemo(() => {
    if (count < 2)
      return {
        error: "Булан үүсгэхийн тулд доод талын 2-оос доошгүй шүүгээ нэмээрэй.",
      };
    try {
      return {
        kitchen:
          mainCount === "auto"
            ? recommendKitchenCorner(kitchen, side, clearanceMm)
            : arrangeKitchenCorner(kitchen, { side, clearanceMm, mainCount }),
      };
    } catch (error) {
      return { error: (error as Error).message };
    }
  }, [kitchen, side, clearanceMm, mainCount, count]);
  const preview = result.kitchen;
  return (
    <section
      className="kitchen-selection-panel"
      data-view="corner"
      aria-label="Булангийн шийдэл"
    >
      <header className="ksp-header">
        <h2>Булангаа сонгох</h2>
        <button
          type="button"
          className="ksp-icon-button"
          aria-label="Булангийн тохиргоог хаах"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      <div className="ksp-scroll">
        <fieldset className="kitchen-feature-fields" disabled={disabled}>
          <p className="ksp-note">
            Талаа сонгоход өрөөнд багтах шүүгээний хуваарилалтыг автоматаар
            олно. Урьдчилсан планаа хараад байрлуулаарай.
          </p>
          <div
            className="ksp-surface-switch"
            role="group"
            aria-label="Булангийн тал"
          >
            <button
              type="button"
              aria-pressed={side === "left"}
              onClick={() => {
                setSide("left");
                setMainCount("auto");
              }}
            >
              ┌ Зүүн булан
            </button>
            <button
              type="button"
              aria-pressed={side === "right"}
              onClick={() => {
                setSide("right");
                setMainCount("auto");
              }}
            >
              Баруун булан ┐
            </button>
          </div>
          {preview && (
            <div className="kitchen-corner-preview">
              <Plan
                kitchen={preview}
                selectedId={null}
                onSelect={() => {}}
                readOnly
                layer="base"
                showMeasurements={false}
              />
              <p className="ksp-note">
                Арын хананд {preview.cornerPlan!.mainCount} · хажуу хананд{" "}
                {count - preview.cornerPlan!.mainCount} шүүгээ. Булангийн зай{" "}
                {clearanceMm} мм.
              </p>
            </div>
          )}
          <details className="kitchen-corner-advanced">
            <summary>Нарийн тохиргоо</summary>
            <label className="ksp-top-picker">
              Шүүгээний хуваарилалт
              <select
                aria-label="Арын ханын шүүгээний тоо"
                value={mainCount}
                onChange={(event) =>
                  setMainCount(
                    event.target.value === "auto"
                      ? "auto"
                      : Number(event.target.value),
                  )
                }
                disabled={disabled || count < 2}
              >
                <option value="auto">Автоматаар тааруулах</option>
                {Array.from({ length: Math.max(0, count - 1) }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Арын хананд {i + 1} · хажууд {count - i - 1}
                  </option>
                ))}
              </select>
            </label>
            <label className="ksp-top-picker">
              Хаалга нээгдэх булангийн зай
              <select
                aria-label="Булангийн зай мм"
                value={clearanceMm}
                onChange={(event) => setClearance(Number(event.target.value))}
                disabled={disabled}
              >
                {[40, 60, 80, 100, 150].map((value) => (
                  <option key={value} value={value}>
                    {value} мм
                  </option>
                ))}
              </select>
            </label>
          </details>
          <p className="ksp-note">
            Буланг зайны хавтангаар хааж, тавцангаар бүтэн бүрхэнэ. Одоо байгаа
            шүүгээний хэмжээ, загвар, материал хадгалагдана.
          </p>
          {result.error && (
            <p className="ksp-note" role="alert">
              {result.error}
            </p>
          )}
          <button
            type="button"
            className="ksp-primary"
            disabled={disabled || !preview}
            onClick={() => {
              if (preview) onApply(preview);
            }}
          >
            Энэ буланг байрлуулах
          </button>
        </fieldset>
      </div>
    </section>
  );
}
