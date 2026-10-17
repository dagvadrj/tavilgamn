"use client";

import { ArrowLeft, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import {
  createStandardKitchenCabinet,
  KITCHEN_STANDARD_CHOICES,
  standardCabinetWidths,
  type KitchenStandardType,
} from "@/lib/kitchenStandardCatalog";
import type { CabinetWidth } from "@/lib/kitchenCabinets";

function CabinetIllustration({ type }: { type: KitchenStandardType }) {
  const tall =
    type === "tall" || type === "oven-tall" || type.startsWith("fridge");
  const wall = type === "wall" || type.startsWith("hood");
  const y = tall ? 10 : wall ? 22 : 45,
    h = tall ? 100 : wall ? 48 : 65;
  return (
    <svg
      className="kitchen-product-art"
      viewBox="0 0 120 125"
      aria-hidden="true"
    >
      <ellipse cx="61" cy="114" rx="38" ry="5" fill="#293c3210" />
      <path d={`M30 ${y}h55l14 9v${h}l-14-9H30Z`} fill="var(--site-line)" />
      <rect
        x="30"
        y={y}
        width="55"
        height={h}
        fill={type.startsWith("fridge") ? "var(--site-muted)" : "#e8e5d6"}
        stroke="var(--site-line)"
      />
      <rect
        x="35"
        y={y + 5}
        width="45"
        height={h - 10}
        fill="none"
        stroke="var(--site-line)"
      />
      <path d={`M75 ${y + h / 2 - 5}v10`} stroke="var(--site-muted)" strokeWidth="2" />
      {type.startsWith("oven") && (
        <>
          <rect
            x="35"
            y={tall ? 48 : 56}
            width="45"
            height="35"
            rx="2"
            fill="var(--site-ink)"
          />
          <rect
            x="40"
            y={tall ? 59 : 67}
            width="35"
            height="20"
            fill="var(--site-muted)"
          />
          <path
            d={tall ? "M40 54h35" : "M40 62h35"}
            stroke="var(--site-line)"
            strokeWidth="2"
          />
        </>
      )}
      {type === "hob" && (
        <>
          <rect x="28" y="40" width="60" height="7" rx="2" fill="var(--site-ink)" />
          <circle cx="42" cy="43" r="2" fill="var(--site-muted)" />
          <circle cx="67" cy="43" r="2" fill="var(--site-muted)" />
        </>
      )}
      {type === "sink" && (
        <>
          <rect
            x="38"
            y="40"
            width="36"
            height="9"
            rx="3"
            fill="var(--site-muted)"
            stroke="var(--site-muted)"
          />
          <path
            d="M66 40V30q0-8-8-8t-8 8"
            fill="none"
            stroke="var(--site-muted)"
            strokeWidth="3"
          />
        </>
      )}
      {type.startsWith("fridge") && (
        <path
          d={type === "fridge-side" ? "M57 10v100" : "M30 77h55"}
          stroke="var(--site-muted)"
          strokeWidth="2"
        />
      )}
      {type === "hood-integrated" && (
        <rect x="30" y="72" width="55" height="7" fill="var(--site-muted)" />
      )}
      {type === "hood-wall" && (
        <>
          <rect x="30" y="22" width="55" height="48" fill="var(--site-hover)" />
          <rect x="50" y="18" width="16" height="33" fill="var(--site-muted)" />
          <path d="m50 51-20 20h56L66 51Z" fill="var(--site-muted)" />
        </>
      )}
    </svg>
  );
}

export function KitchenStandardLibrary({
  type,
  width,
  disabled,
  atLimit,
  ceiling = 2700,
  onType,
  onWidth,
  onAdd,
}: {
  type: KitchenStandardType;
  width: CabinetWidth;
  disabled: boolean;
  atLimit: boolean;
  onType: (type: KitchenStandardType) => void;
  onWidth: (width: CabinetWidth) => void;
  onAdd: () => boolean | void;
  ceiling?: number;
}) {
  const [query, setQuery] = useState("");
  const [configuring, setConfiguring] = useState(false);
  const [category, setCategory] = useState(0);
  useEffect(() => {
    setCategory(
      type === "wall" || type.startsWith("hood")
        ? 1
        : type === "tall" || type === "oven-tall"
          ? 2
          : type.startsWith("fridge")
            ? 3
            : 0,
    );
  }, [type]);
  const widths = standardCabinetWidths(type);
  const selected = KITCHEN_STANDARD_CHOICES.find(
    (choice) => choice.id === type,
  )!;
  const preview = createStandardKitchenCabinet(type, "preview", width, ceiling);
  const matches = (label: string) =>
    label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  const groups = [
    { title: "Доод шүүгээ", ids: ["base", "sink", "hob", "oven-base"] },
    { title: "Дээд шүүгээ", ids: ["wall", "hood-integrated", "hood-wall"] },
    { title: "Багана шүүгээ", ids: ["tall", "oven-tall"] },
    { title: "Төхөөрөмж", ids: ["fridge-top", "fridge-side"] },
  ];
  return (
    <section
      className="kp-panel planner-standard-builder"
      aria-label="Бэлэн шүүгээ, төхөөрөмж"
    >
      <div className="planner-inspector-intro">
        <h2>{configuring ? "Хэмжээгээ сонгоорой" : "Юу нэмэх вэ?"}</h2>
        <p>
          {configuring
            ? "Өргөнөө сонгоод доорх цэнхэр товчийг дараарай."
            : "Зураг дээр дараад хэмжээ сонгоно. Дараа нь өрөөнд нэмнэ."}
        </p>
      </div>
      {!configuring && (
        <>
          <label className="kitchen-library-search">
            <Search size={16} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Нэрээр хайх"
              aria-label="Бэлэн шүүгээ, төхөөрөмж хайх"
            />
          </label>
          <div
            className="kitchen-library-categories"
            role="group"
            aria-label="Нэмэх зүйлийн төрөл"
          >
            {groups.map((group, index) => (
              <button
                type="button"
                key={group.title}
                aria-pressed={category === index && !query.trim()}
                onClick={() => {
                  setCategory(index);
                  setQuery("");
                }}
              >
                {["Доод", "Дээд", "Багана", "Төхөөрөмж"][index]}
              </button>
            ))}
          </div>
        </>
      )}
      {configuring && (
        <button
          type="button"
          className="kitchen-library-back"
          onClick={() => setConfiguring(false)}
        >
          <ArrowLeft size={16} /> Өөр төрөл сонгох
        </button>
      )}
      <fieldset className="km-fields" disabled={disabled}>
        {configuring && (
          <div className="kitchen-add-summary">
            <div className="kitchen-standard-selected">
              <CabinetIllustration type={type} />
              <div>
                <span className="kitchen-eyebrow">ТАНЫ СОНГОЛТ</span>
                <strong>{selected.label}</strong>
                <p>
                  {preview.width} × {preview.depth} × {preview.height} мм
                </p>
                <small>Өргөн × гүн × өндөр</small>
              </div>
            </div>
            {widths.length > 0 ? (
              <div className="kitchen-width-control">
                <span>
                  Өргөн <small>мм</small>
                </span>
                <div
                  className="kitchen-width-options"
                  role="group"
                  aria-label="Шүүгээний өргөн, миллиметр"
                >
                  {widths.map((value) => (
                    <button
                      type="button"
                      key={value}
                      aria-pressed={width === value}
                      onClick={() => onWidth(value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p>Стандарт хэмжээтэй. Нэмсний дараа тохиргоог нь шалгаарай.</p>
            )}
            <button
              type="button"
              className="kp-primary"
              disabled={atLimit}
              onClick={() => {
                if (onAdd() === true) setConfiguring(false);
              }}
            >
              <Plus size={16} aria-hidden="true" /> {selected.label} нэмэх
            </button>
            {atLimit && (
              <p role="status">
                80 шүүгээний хязгаарт хүрсэн. Шүүгээ хасаж байж шинээр нэмнэ.
              </p>
            )}
          </div>
        )}
        {!configuring &&
          groups
            .filter(
              (group, index) =>
                (query.trim() || category === index) &&
                KITCHEN_STANDARD_CHOICES.some(
                  (choice) =>
                    group.ids.includes(choice.id) && matches(choice.label),
                ),
            )
            .map((group) => (
              <div className="kitchen-choice-group" key={group.title}>
                <h3>{group.title}</h3>
                <div
                  className="reference-type-grid"
                  role="group"
                  aria-label={group.title}
                >
                  {KITCHEN_STANDARD_CHOICES.filter(
                    (choice) =>
                      group.ids.includes(choice.id) && matches(choice.label),
                  ).map((choice) => (
                    <button
                      type="button"
                      key={choice.id}
                      disabled={atLimit}
                      onClick={() => {
                        onType(choice.id);
                        setConfiguring(true);
                      }}
                    >
                      <CabinetIllustration type={choice.id} />
                      <span className="kitchen-product-action">
                        Хэмжээ сонгох →
                      </span>
                      <span>{choice.label}</span>
                      <small className="kitchen-product-size">
                        {
                          createStandardKitchenCabinet(
                            choice.id,
                            "card",
                            600,
                            ceiling,
                          ).width
                        }{" "}
                        ×{" "}
                        {
                          createStandardKitchenCabinet(
                            choice.id,
                            "card",
                            600,
                            ceiling,
                          ).depth
                        }{" "}
                        ×{" "}
                        {
                          createStandardKitchenCabinet(
                            choice.id,
                            "card",
                            600,
                            ceiling,
                          ).height
                        }{" "}
                        мм
                      </small>
                    </button>
                  ))}
                </div>
              </div>
            ))}
        {!KITCHEN_STANDARD_CHOICES.some((choice) => matches(choice.label)) && (
          <p className="kitchen-section-help" role="status">
            Хайлтанд тохирох зүйл олдсонгүй. Өөр нэрээр хайгаарай.
          </p>
        )}
        {!configuring && atLimit && (
          <p role="status">
            80 шүүгээний хязгаарт хүрсэн. Шүүгээ хасаж байж шинээр нэмнэ.
          </p>
        )}
      </fieldset>
    </section>
  );
}
