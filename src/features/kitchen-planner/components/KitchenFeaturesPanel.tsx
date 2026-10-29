"use client";
import { useState } from "react";
import { Lightbulb, RectangleHorizontal, X } from "lucide-react";
import type { ModularKitchen } from "@/lib/kitchenCabinets";
import {
  DEFAULT_KITCHEN_LINE_LIGHTING,
  kitchenLightStrips,
  type KitchenLineLighting,
} from "@/lib/kitchenLighting";
import {
  KITCHEN_PLANNING_FURNITURE,
  type KitchenPlanningFurnitureKind,
} from "@/lib/kitchenPlanningFurniture";
import { DimensionInput } from "./PlannerPanels";
import "./kitchen-features.css";

export function KitchenFeaturesPanel({
  kitchen,
  section,
  disabled,
  onLighting,
  onAdd,
  onClose,
}: {
  kitchen: ModularKitchen;
  section: "lighting" | "island";
  disabled: boolean;
  onLighting: (settings: KitchenLineLighting) => void;
  onAdd: (
    kind: KitchenPlanningFurnitureKind,
    size: { width: number; depth: number; height: number },
  ) => boolean;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<KitchenPlanningFurnitureKind>("island");
  const [size, setSize] = useState<{
    width: number;
    depth: number;
    height: number;
  }>({ ...KITCHEN_PLANNING_FURNITURE.island });
  const [error, setError] = useState("");
  const lights = kitchen.lineLighting ?? DEFAULT_KITCHEN_LINE_LIGHTING;
  const patch = (value: Partial<KitchenLineLighting>) =>
    onLighting({ ...lights, ...value });
  const length = kitchenLightStrips(kitchen).reduce(
    (sum, strip) => sum + strip.length,
    0,
  );
  return (
    <section
      className="kitchen-selection-panel"
      aria-label={section === "lighting" ? "Шугаман гэрэл" : "Тек болон арал"}
    >
      <header className="ksp-header">
        <h2>{section === "lighting" ? "Шугаман гэрэл" : "Тек / Арал"}</h2>
        <button
          type="button"
          className="ksp-icon-button"
          aria-label="Тохиргоог хаах"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      <div className="ksp-scroll">
        <fieldset className="kitchen-feature-fields" disabled={disabled}>
          {section === "lighting" ? (
            <>
              <div className="kitchen-feature-intro">
                <Lightbulb size={26} />
                <p>Шүүгээний уртыг дагасан гэрлийг нэг товчоор асаана.</p>
              </div>
              <label className="kitchen-feature-check">
                <input
                  type="checkbox"
                  checked={lights.underCabinet}
                  onChange={(e) => patch({ underCabinet: e.target.checked })}
                />
                <span>
                  Дээд шүүгээний доорх гэрэл<small>Ажлын тавцан дагуу</small>
                </span>
              </label>
              <label className="kitchen-feature-check">
                <input
                  type="checkbox"
                  checked={lights.plinth}
                  onChange={(e) => patch({ plinth: e.target.checked })}
                />
                <span>
                  Доод шүүгээний хөлийн гэрэл
                  <small>Шал дагуу зөөлөн гэрэлтүүлэг</small>
                </span>
              </label>
              {lights.underCabinet &&
                !kitchen.cabinets.some(
                  (c) => c.type === "wall" && c.opening !== "hood",
                ) && (
                  <p className="ksp-note" role="status">
                    Гэрэл харагдахын тулд дээд шүүгээ нэмээрэй.
                  </p>
                )}
              {lights.plinth &&
                !kitchen.cabinets.some((c) => c.type === "base") && (
                  <p className="ksp-note" role="status">
                    Хөлийн гэрэлд доод шүүгээ нэмээрэй.
                  </p>
                )}
              <label className="kp-field">
                <span>Гэрлийн өнгө</span>
                <select
                  value={lights.tone}
                  onChange={(e) =>
                    patch({
                      tone: e.target.value as KitchenLineLighting["tone"],
                    })
                  }
                >
                  <option value="warm">Дулаан · 3000K</option>
                  <option value="neutral">Завсрын · 4000K</option>
                  <option value="cool">Хүйтэн · 6000K</option>
                </select>
              </label>
              <label className="kp-field">
                <span>Гэрлийн хүч · {lights.brightness}%</span>
                <input
                  aria-label="Гэрлийн хүч"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={lights.brightness}
                  onChange={(e) =>
                    patch({ brightness: Number(e.target.value) })
                  }
                />
              </label>
              <p className="ksp-note">
                Нийт урт: {(length / 1000).toFixed(2)} м. Шүүгээ зөөхөд гэрэл
                дагаж өөрчлөгдөнө.
              </p>
            </>
          ) : (
            <>
              <div className="kitchen-feature-intro">
                <RectangleHorizontal size={26} />
                <p>
                  Хэмжээгээ сонгоод нэмнэ. Байрлуулсны дараа чирж зөөж, 90°
                  эргүүлж болно.
                </p>
              </div>
              <div
                className="ksp-surface-switch"
                role="group"
                aria-label="Тек эсвэл арал сонгох"
              >
                {(["island", "bar"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={kind === value}
                    onClick={() => {
                      setKind(value);
                      setSize({ ...KITCHEN_PLANNING_FURNITURE[value] });
                      setError("");
                    }}
                  >
                    {value === "island"
                      ? "Арал · шүүгээтэй"
                      : "Тек · суух зайтай"}
                  </button>
                ))}
              </div>
              <svg
                className="kitchen-furniture-preview"
                viewBox="0 0 280 140"
                role="img"
                aria-label={
                  kind === "island"
                    ? "Шүүгээтэй, тавцангийн илүү гарсан ирмэгтэй арал"
                    : "Хоёр тулгууртай, доороо суух зайтай тек"
                }
              >
                <rect
                  x="24"
                  y="25"
                  width="232"
                  height="12"
                  rx="3"
                  fill="#ece7dc"
                  stroke="#867462"
                />
                {kind === "island" ? (
                  <>
                    <rect
                      x="33"
                      y="38"
                      width="214"
                      height="78"
                      rx="2"
                      fill="#b99165"
                    />
                    <path d="M104 40v73m71-73v73" stroke="#705538" />
                    <rect
                      x="42"
                      y="116"
                      width="196"
                      height="7"
                      fill="#49443d"
                    />
                  </>
                ) : (
                  <>
                    <path
                      d="M37 38v85m206-85v85"
                      stroke="#b99165"
                      strokeWidth="9"
                    />
                    <path d="M42 44h196" stroke="#b99165" strokeWidth="12" />
                  </>
                )}
              </svg>
              <DimensionInput
                label="Өргөн"
                value={size.width}
                min={600}
                max={3000}
                onCommit={(width) => {
                  setSize((s) => ({ ...s, width: Math.round(width) }));
                  setError("");
                }}
              />
              <DimensionInput
                label="Гүн"
                value={size.depth}
                min={kind === "island" ? 600 : 350}
                max={1400}
                onCommit={(depth) => {
                  setSize((s) => ({ ...s, depth: Math.round(depth) }));
                  setError("");
                }}
              />
              <DimensionInput
                label="Өндөр"
                value={size.height}
                min={750}
                max={1200}
                onCommit={(height) => {
                  setSize((s) => ({ ...s, height: Math.round(height) }));
                  setError("");
                }}
              />
              <p className="ksp-note">
                Шүүгээнээс 900 мм ажлын зайтай сул хэсэгт автоматаар байрлуулна.
                Эцсийн байрлалыг 2D планаас шалгаарай.
              </p>
              {error && (
                <p className="kitchen-feature-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="ksp-primary"
                type="button"
                onClick={() => {
                  if (!onAdd(kind, size))
                    setError(
                      "Энэ хэмжээтэй тавилга 900 мм ажлын зайтай багтахгүй байна. Хэмжээг багасгах эсвэл шүүгээг зөөгөөрэй.",
                    );
                }}
              >
                {kind === "island" ? "Арал нэмэх" : "Тек нэмэх"}
              </button>
            </>
          )}
        </fieldset>
      </div>
    </section>
  );
}
