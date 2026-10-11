"use client";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  DoorOpen,
  LayoutGrid,
  Ruler,
  ShieldCheck,
  Square,
  X,
} from "lucide-react";
import type { ModularKitchen } from "@/lib/kitchenCabinets";
import { startKitchen, type KitchenStartOptions } from "@/lib/kitchenStart";
import { Plan } from "./PlannerPanels";
import { useKitchenDialog } from "./useKitchenDialog";

export function KitchenStartDialog({
  kitchen,
  disabled,
  onClose,
  onCreate,
}: {
  kitchen: ModularKitchen;
  disabled: boolean;
  onClose: () => void;
  onCreate: (kitchen: ModularKitchen) => boolean;
}) {
  const ref = useKitchenDialog(true, onClose);
  const [error, setError] = useState("");
  const [options, setOptions] = useState<KitchenStartOptions>({
    ...kitchen.room,
    layout: "l-right",
    furnished: true,
    useSelected: false,
    useCatalog: true,
    door: true,
    window: true,
  });
  const patch = (next: Partial<KitchenStartOptions>) => {
    setOptions((v) => ({ ...v, ...next }));
    setError("");
  };
  return (
    <div className="kitchen-start-layer">
      <section
        ref={ref}
        className="kitchen-start-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kitchen-start-title"
      >
        <header className="kitchen-start-brandbar">
          <div className="kitchen-start-brand">
            <span className="kitchen-start-monogram">T</span>
            <div>
              <strong>
                tavilga.mn <small>3D Studio</small>
              </strong>
              <p>Гал тогооны ухаалаг төлөвлөгч</p>
            </div>
          </div>
          <span className="kitchen-start-local">
            <i /> Энэ төхөөрөмж дээр хадгална
          </span>
          <button type="button" aria-label="Эхлэх цонх хаах" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <div className="kitchen-start-content">
          <div className="kitchen-start-resume">
            <div className="kitchen-start-thumbnail">
              <Plan
                kitchen={kitchen}
                selectedId={null}
                onSelect={() => {}}
                readOnly
              />
            </div>
            <div>
              <span className="kitchen-start-draft">ОДООГИЙН ТӨЛӨВЛӨГӨӨ</span>
              <h2 id="kitchen-start-title">
                {kitchen.room.width / 1000} × {kitchen.room.depth / 1000} м гал
                тогоо
              </h2>
              <p>
                {kitchen.cabinets.length} шүүгээ · Ажлаа үргэлжлүүлэхэд бэлэн
              </p>
            </div>
            <button
              type="button"
              className="kp-primary"
              disabled={disabled}
              onClick={onClose}
            >
              Үргэлжлүүлэх <ArrowRight size={18} />
            </button>
          </div>
          <div className="kitchen-start-divider">
            <span>ЭСВЭЛ ШИНЭЭР ЭХЛЭХ</span>
          </div>
          <div className="kitchen-start-card">
            <div className="kitchen-start-choices">
              <button
                type="button"
                disabled={disabled}
                aria-pressed={!options.furnished}
                onClick={() => patch({ furnished: false })}
              >
                <span className="kitchen-start-choice-icon">
                  <Square size={25} />
                </span>
                <div>
                  <strong>Хоосон гал тогоо</strong>
                  <p>
                    Өрөөний хэмжээгээ оруулаад шүүгээнүүдээ өөрийн гараар
                    байрлуулах.
                  </p>
                </div>
                <small>
                  0 MODULE PRESETS <span>Чөлөөт төлөвлөлт</span>
                </small>
                {!options.furnished && (
                  <Check className="kitchen-start-check" size={22} />
                )}
              </button>
              <button
                type="button"
                disabled={disabled}
                aria-pressed={options.furnished}
                onClick={() => patch({ furnished: true })}
              >
                <span className="kitchen-start-choice-icon">
                  <LayoutGrid size={25} />
                </span>
                <div>
                  <strong>
                    Бэлэн байрлал санал болгох <em>Зөвлөмж</em>
                  </strong>
                  <p>
                    Өрөөний хэмжээнд тохирсон шүүгээний зохион байгуулалтаас
                    эхлэх.
                  </p>
                </div>
                <small>
                  SMART LAYOUT <span>Хэмжээнд тань тохируулна</span>
                </small>
                {options.furnished && (
                  <Check className="kitchen-start-check" size={22} />
                )}
              </button>
            </div>
            <div className="kitchen-start-options">
              <fieldset disabled={disabled || !options.furnished}>
                <legend>
                  <LayoutGrid size={16} /> Ашиглах шүүгээний эх үүсвэр
                </legend>
                <label>
                  <input
                    type="checkbox"
                    checked={options.useCatalog}
                    onChange={(event) =>
                      patch({ useCatalog: event.target.checked })
                    }
                  />{" "}
                  Каталогийн бэлэн модуль шүүгээнүүд
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={options.useSelected}
                    onChange={(event) =>
                      patch({ useSelected: event.target.checked })
                    }
                  />{" "}
                  Миний өмнө сонгосон тавилга (
                  {kitchen.cabinets.length + (kitchen.extras?.length ?? 0)})
                </label>
                {options.furnished && (
                  <label className="kitchen-start-layout">
                    Гарнитурын хэлбэр
                    <select
                      value={options.layout}
                      onChange={(event) =>
                        patch({
                          layout: event.target
                            .value as KitchenStartOptions["layout"],
                        })
                      }
                    >
                      <option value="straight">I · Шулуун</option>
                      <option value="l-right">L · Булантай</option>
                      <option value="u">U · Гурван талт</option>
                      <option value="double-side">Хоёр талт</option>
                    </select>
                  </label>
                )}
              </fieldset>
              <fieldset disabled={disabled}>
                <legend>
                  <DoorOpen size={16} /> Хаалга, цонхны байрлал
                </legend>
                <label>
                  <input
                    type="radio"
                    name="kitchen-openings"
                    checked={options.door && options.window}
                    onChange={() => patch({ door: true, window: true })}
                  />{" "}
                  Стандарт хаалга, цонхтой эхлэх
                </label>
                <label>
                  <input
                    type="radio"
                    name="kitchen-openings"
                    checked={!options.door && !options.window}
                    onChange={() => patch({ door: false, window: false })}
                  />{" "}
                  Дараа нь гараар оруулах
                </label>
                <p>Байрлал, хэмжээг дараагийн алхамд засварлаж болно.</p>
              </fieldset>
              <div className="kitchen-start-measurements">
                <span>
                  <Ruler size={17} /> Эхлэх өрөөний хэмжээ
                </span>
                <div className="kitchen-start-dimensions">
                  {(["width", "depth", "height"] as const).map((key, index) => (
                    <label key={key}>
                      {["Өргөн", "Гүн", "Өндөр"][index]}
                      <span>
                        <input
                          type="number"
                          disabled={disabled}
                          value={
                            Number.isFinite(options[key]) ? options[key] : ""
                          }
                          min={key === "height" ? 2200 : 2000}
                          max={key === "height" ? 3500 : 8000}
                          step={10}
                          onChange={(event) =>
                            patch({ [key]: event.target.valueAsNumber })
                          }
                        />{" "}
                        мм
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            {error && (
              <p className="kitchen-start-error" role="alert">
                {error}
              </p>
            )}
            <button
              type="button"
              className="kp-primary kitchen-start-submit"
              disabled={disabled}
              onClick={() => {
                try {
                  if (onCreate(startKitchen(kitchen, options))) onClose();
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Өрөө үүсгэж чадсангүй.",
                  );
                }
              }}
            >
              Төлөвлөж эхлэх <ArrowRight size={22} />
            </button>
          </div>
        </div>
        <footer className="kitchen-start-footer">
          <span>
            <ShieldCheck size={16} /> Төлөвлөгөө таны хөтөч дээр автоматаар
            хадгалагдана
          </span>
          <span>Бүх хэмжээс миллиметрээр</span>
        </footer>
      </section>
    </div>
  );
}
