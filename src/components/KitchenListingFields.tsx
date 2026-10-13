"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { KitchenTokenInput } from "./KitchenTokenInput";
import {
  KITCHEN_STYLE_LABELS,
  KITCHEN_TAG_SUGGESTIONS,
  KITCHEN_MATERIAL_SUGGESTIONS,
  KITCHEN_SERVICE_AREAS,
  kitchenListTokens,
  type KitchenListingSuggestions,
} from "@/lib/kitchenListingSuggestions";
import "./kitchen-listing-form.css";

export type KitchenListingForm = {
  title: string;
  shortDescription: string;
  description: string;
  style: string;
  pricingMode: "fixed" | "from" | "quote";
  priceFrom: string;
  priceTo: string;
  materials: string;
  leadTimeDays: string;
  warrantyMonths: string;
  installationIncluded: boolean;
  tags: string;
  serviceAreas: string;
  inclusions: string;
  exclusions: string;
};
export type KitchenTextSource =
  { sourceKitchenId: string } | { designId: string; versionId: string };
type TextField = "title" | "shortDescription" | "description";

function SuggestedTextField({
  field,
  label,
  value,
  onChange,
  suggestions,
  form,
  owner,
  source,
  disabled,
}: {
  field: TextField;
  label: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  form: KitchenListingForm;
  owner: string;
  source: KitchenTextSource | null;
  disabled: boolean;
}) {
  const textId = useId();
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState("");
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const sourceKey = JSON.stringify(source);
  useEffect(() => {
    controller.current?.abort();
    setBusy(false);
    setProposal("");
    setError("");
    return () => controller.current?.abort();
  }, [sourceKey]);
  const generate = async () => {
    if (!source || busy) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    setProposal("");
    try {
      const response = await authFetch(
        "/api/merchant/kitchen-designs/suggest",
        {
          method: "POST",
          signal: abort.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...source,
            field,
            title: form.title,
            style: form.style,
            materials: kitchenListTokens(form.materials),
            inclusions: kitchenListTokens(form.inclusions),
            exclusions: kitchenListTokens(form.exclusions),
          }),
        },
        owner,
      );
      const result = await response.json().catch(() => null);
      if (abort.signal.aborted) return;
      if (!response.ok || typeof result?.text !== "string")
        throw new Error(result?.error || "Текст үүсгэж чадсангүй.");
      setProposal(result.text);
    } catch (reason) {
      if (!abort.signal.aborted)
        setError(
          reason instanceof Error ? reason.message : "Текст үүсгэж чадсангүй.",
        );
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  };
  return (
    <div className={`km-field ${field !== "title" ? "km-field-wide" : ""}`}>
      <div className="km-field-heading">
        <label htmlFor={textId}>
          {label}
          {field === "title" && <span aria-hidden="true"> *</span>}
        </label>
        <button
          className="km-ai-button"
          type="button"
          disabled={disabled || busy || !source}
          onClick={() => void generate()}
        >
          {busy ? (
            <LoaderCircle size={13} className="animate-spin" />
          ) : (
            <Sparkles size={13} />
          )}
          {busy ? "Үүсгэж байна…" : "AI-аар үүсгэх"}
        </button>
      </div>
      {field === "title" ? (
        <input
          id={textId}
          className="input"
          required
          minLength={3}
          maxLength={160}
          value={value}
          disabled={disabled}
          placeholder="Жишээ: Модерн L хэлбэрийн гал тогоо"
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <textarea
          id={textId}
          className="input"
          rows={field === "shortDescription" ? 2 : 4}
          maxLength={field === "shortDescription" ? 300 : 10000}
          value={value}
          disabled={disabled}
          placeholder={
            field === "shortDescription"
              ? "Жагсаалт дээр харагдах 1–2 өгүүлбэр"
              : "Материал, бүрдэл, захиалгын онцлогоо бичээрэй"
          }
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      <div className="km-text-suggestions">
        {suggestions
          .filter((item) => item !== value)
          .slice(0, 2)
          .map((item) => (
            <button
              type="button"
              key={item}
              disabled={disabled}
              onClick={() => onChange(item)}
            >
              {item}
            </button>
          ))}
      </div>
      {proposal && (
        <div className="km-ai-proposal">
          <span>
            <Sparkles size={12} />
            AI санал
          </span>
          <p>{proposal}</p>
          <div>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                onChange(proposal);
                setProposal("");
              }}
            >
              Хэрэглэх
            </button>
            <button type="button" onClick={() => setProposal("")}>
              Болих
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="km-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function KitchenListingFields({
  form,
  field,
  suggestions,
  owner,
  source,
  disabled = false,
}: {
  form: KitchenListingForm;
  field: <K extends keyof KitchenListingForm>(
    key: K,
    value: KitchenListingForm[K],
  ) => void;
  suggestions: KitchenListingSuggestions | null;
  owner: string;
  source: KitchenTextSource | null;
  disabled?: boolean;
}) {
  const id = useId();
  const changeList = (key: "inclusions" | "exclusions", value: string) => {
    field(key, value);
    const opposite = key === "inclusions" ? "exclusions" : "inclusions";
    const keys = new Set(
      kitchenListTokens(value).map((item) => item.toLocaleLowerCase("mn")),
    );
    if (keys.has("угсралт"))
      field("installationIncluded", key === "inclusions");
    else if (
      key === "inclusions" &&
      kitchenListTokens(form.inclusions).some(
        (item) => item.toLocaleLowerCase("mn") === "угсралт",
      )
    )
      field("installationIncluded", false);
    field(
      opposite,
      kitchenListTokens(form[opposite])
        .filter((item) => !keys.has(item.toLocaleLowerCase("mn")))
        .join("\n"),
    );
  };
  return (
    <div className="km-listing-fields">
      <fieldset className="km-field-section" disabled={disabled}>
        <legend>
          <span>01</span>Үндсэн мэдээлэл
        </legend>
        <div className="km-fields-grid">
          <SuggestedTextField
            field="title"
            label="Загварын нэр"
            value={form.title}
            onChange={(value) => field("title", value)}
            suggestions={suggestions?.titles ?? []}
            form={form}
            owner={owner}
            source={source}
            disabled={disabled}
          />
          <div className="km-field">
            <label htmlFor={id + "-style"}>Хэв маяг</label>
            <select
              id={id + "-style"}
              className="input"
              value={form.style}
              onChange={(event) => field("style", event.target.value)}
            >
              {Object.entries(KITCHEN_STYLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <p className="km-field-hint">
              Загварт хамгийн ойр хэв маягийг сонгоорой.
            </p>
          </div>
          <SuggestedTextField
            field="shortDescription"
            label="Товч тайлбар"
            value={form.shortDescription}
            onChange={(value) => field("shortDescription", value)}
            suggestions={suggestions?.shortDescriptions ?? []}
            form={form}
            owner={owner}
            source={source}
            disabled={disabled}
          />
          <SuggestedTextField
            field="description"
            label="Дэлгэрэнгүй тайлбар"
            value={form.description}
            onChange={(value) => field("description", value)}
            suggestions={suggestions?.descriptions ?? []}
            form={form}
            owner={owner}
            source={source}
            disabled={disabled}
          />
          <div className="km-field-wide">
            <KitchenTokenInput
              label="Материал"
              value={form.materials}
              onChange={(value) => field("materials", value)}
              suggestions={[
                ...new Set([
                  ...(suggestions?.materials ?? []),
                  ...KITCHEN_MATERIAL_SUGGESTIONS,
                ]),
              ]}
              disabled={disabled}
            />
          </div>
        </div>
      </fieldset>
      <fieldset className="km-field-section" disabled={disabled}>
        <legend>
          <span>02</span>Үнэ ба үйлчилгээ
        </legend>
        <div className="km-fields-grid">
          <div className="km-field">
            <label htmlFor={id + "-pricing"}>Үнийн төрөл</label>
            <select
              id={id + "-pricing"}
              className="input"
              value={form.pricingMode}
              onChange={(event) =>
                field(
                  "pricingMode",
                  event.target.value as KitchenListingForm["pricingMode"],
                )
              }
            >
              <option value="quote">Үнийн санал авах</option>
              <option value="from">Эхлэх үнэ</option>
              <option value="fixed">Тогтмол үнэ</option>
            </select>
            <p className="km-field-hint">
              Үнэ тодорхойгүй бол үнийн санал сонгоорой.
            </p>
          </div>
          {form.pricingMode !== "quote" && (
            <div className="km-field">
              <label htmlFor={id + "-price"}>
                {form.pricingMode === "fixed" ? "Үнэ" : "Эхлэх үнэ"} (₮)
              </label>
              <input
                id={id + "-price"}
                className="input"
                inputMode="numeric"
                type="number"
                min={0}
                required
                value={form.priceFrom}
                onChange={(event) => field("priceFrom", event.target.value)}
              />
              <p className="km-field-hint">
                {form.priceFrom
                  ? `${Number(form.priceFrom).toLocaleString("en-US")} ₮`
                  : "Төгрөгөөр оруулна."}
              </p>
            </div>
          )}
          {form.pricingMode === "from" && (
            <div className="km-field">
              <label htmlFor={id + "-price-to"}>Дээд үнэ (заавал биш)</label>
              <input
                id={id + "-price-to"}
                className="input"
                type="number"
                min={form.priceFrom || 0}
                value={form.priceTo}
                onChange={(event) => field("priceTo", event.target.value)}
              />
              <p className="km-field-hint">Эхлэх үнээс багагүй байна.</p>
            </div>
          )}
          <div className="km-field">
            <label htmlFor={id + "-lead-time"}>Үйлдвэрлэх хоног</label>
            <input
              id={id + "-lead-time"}
              className="input"
              type="number"
              min={1}
              max={365}
              value={form.leadTimeDays}
              placeholder="Жишээ: 14"
              onChange={(event) => field("leadTimeDays", event.target.value)}
            />
            <div className="km-suggestions">
              {[7, 14, 21, 30].map((days) => (
                <button
                  type="button"
                  key={days}
                  onClick={() => field("leadTimeDays", String(days))}
                  aria-pressed={form.leadTimeDays === String(days)}
                >
                  {days} хоног
                </button>
              ))}
            </div>
          </div>
          <div className="km-field-wide">
            <KitchenTokenInput
              label="Үйлчилгээний бүс"
              value={form.serviceAreas}
              onChange={(value) => field("serviceAreas", value)}
              suggestions={KITCHEN_SERVICE_AREAS}
              disabled={disabled}
              placeholder="Өөр байршил нэмэх…"
            />
          </div>
          <label className="km-installation km-field-wide">
            <input
              type="checkbox"
              checked={form.installationIncluded}
              onChange={(event) => {
                field("installationIncluded", event.target.checked);
                const target = event.target.checked
                  ? "inclusions"
                  : "exclusions";
                const other = event.target.checked
                  ? "exclusions"
                  : "inclusions";
                field(
                  target,
                  kitchenListTokens(`${form[target]}\nУгсралт`).join("\n"),
                );
                field(
                  other,
                  kitchenListTokens(form[other])
                    .filter((item) => item !== "Угсралт")
                    .join("\n"),
                );
              }}
            />
            <span>
              Угсралт үнэд багтсан
              <small>
                Угсралтын нөхцөлийг бүрдлийн жагсаалтад мөн шинэчилнэ.
              </small>
            </span>
          </label>
        </div>
      </fieldset>
      <fieldset className="km-field-section" disabled={disabled}>
        <legend>
          <span>03</span>Бүрдэл ба хайлт
        </legend>
        <p className="km-bom-note">
          {suggestions
            ? "Сонгосон загварын BOM-оос санал болгосон бүрдэл. Тоног төхөөрөмж, нэмэлт тавилгыг анх тусад нь тооцсон; үнэдээ багтаах бол сонголтыг шилжүүлээрэй."
            : "Загвараа сонгоход бүрдлийг автоматаар санал болгоно."}
        </p>
        <div className="km-fields-grid">
          <KitchenTokenInput
            label="Үнэд багтсан"
            value={form.inclusions}
            onChange={(value) => changeList("inclusions", value)}
            suggestions={[
              ...(suggestions?.inclusions ?? []),
              ...(suggestions?.exclusions ?? []),
              "Угсралт",
              "Хүргэлт",
            ]}
            disabled={disabled}
          />
          <KitchenTokenInput
            label="Үнэд багтаагүй"
            value={form.exclusions}
            onChange={(value) => changeList("exclusions", value)}
            suggestions={[
              ...(suggestions?.exclusions ?? []),
              ...(suggestions?.inclusions ?? []),
              "Угсралт",
              "Хүргэлт",
              "Сантехникийн холболт",
              "Цахилгааны холболт",
            ]}
            disabled={disabled}
          />
          <div className="km-field-wide">
            <KitchenTokenInput
              label="Хайлтын tag"
              value={form.tags}
              onChange={(value) => field("tags", value)}
              suggestions={[
                ...new Set([
                  ...(suggestions?.tags ?? []),
                  ...KITCHEN_TAG_SUGGESTIONS,
                ]),
              ]}
              maxItems={20}
              disabled={disabled}
              placeholder="Өөр tag бичээд Enter…"
            />
            <p className="km-field-hint">
              20 хүртэл tag. Хэрэглэгч эдгээр үгээр загварыг хайж олно.
            </p>
          </div>
        </div>
      </fieldset>
    </div>
  );
}
