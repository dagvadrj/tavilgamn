"use client";
import { useMemo, useState, type ReactNode } from "react";
import { PlannerLink as Link } from "@/components/PlannerLink";
import type { KitchenBom } from "@/lib/kitchenBom";
import type { ModularKitchen } from "@/lib/kitchenCabinets";
import {
  MEASURE_DISTRICTS,
  MEASURE_SLOTS,
  bomMoney,
  handoffWarnings,
  kitchenProjectTitle,
  measureFormErrors,
  presentKitchenBom,
  wallLetter,
  type MeasureForm,
} from "@/lib/kitchenWorkspace";

const ITEM_LABEL: Record<string, string> = {
  door: "Хаалга",
  window: "Цонх",
  column: "Багана",
  water: "Ус / бохир",
  power: "Цахилгаан",
  vent: "Агааржуулалт",
};

/** K7 contents: what the measurer receives, drawn only from the design. */
export function KitchenHandoffSheet({
  kitchen,
  bom,
  revision,
  saved,
  image,
  finishLabel,
  conflict,
  onKeepMine,
  onOpenTheirs,
  exports,
}: {
  kitchen: ModularKitchen;
  bom: KitchenBom;
  revision: number;
  saved: boolean;
  image: string | null;
  finishLabel: { front: string; countertop: string };
  conflict: boolean;
  onKeepMine: () => void;
  onOpenTheirs: () => void;
  exports: ReactNode;
}) {
  const view = useMemo(() => presentKitchenBom(bom), [bom]);
  const items = kitchen.room.items ?? [];
  const warnings = handoffWarnings({ room: kitchen.room, cabinets: kitchen.cabinets, unpricedCount: view.unpriced.length });
  const openings = items.filter((item) => item.kind === "door" || item.kind === "window");
  return (
    <div className="kitchen-k-handoff">
      {conflict && (
        <div className="kitchen-k-banner is-warn kitchen-k-wide" role="alert">
          <strong>Хувилбарын зөрчил</strong>
          <span>
            Өөр төхөөрөмж дээр шинэ хувилбар хадгалагдсан. Хэмжилтийн хүсэлт зөрчил шийдтэл түгжигдэнэ.
          </span>
          <button type="button" className="kitchen-k-ink" onClick={onKeepMine}>
            Минийхийг v{revision + 1} болгох
          </button>
          <button type="button" className="kitchen-k-secondary" onClick={onOpenTheirs}>
            Тэднийхийг нээх
          </button>
        </div>
      )}
      <section className="kitchen-k-card kitchen-k-wide kitchen-k-snapshot">
        <div className="kitchen-k-snapshot-image">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local capture (data URL)
            <img src={image} alt="Хэмжилтийн snapshot — одоогийн материалтай гал тогоо" />
          ) : (
            <span>3D зураг хараахан аваагүй</span>
          )}
        </div>
        <div>
          <span className="kitchen-k-eyebrow">
            Handoff snapshot · {saved ? `v${revision}` : "хадгалаагүй"}
          </span>
          <h1>{kitchenProjectTitle(kitchen.room)}</h1>
          <dl>
            <dt>Өрөө</dt>
            <dd>
              {kitchen.room.width} × {kitchen.room.depth} × {kitchen.room.height} мм
            </dd>
            <dt>Нүх</dt>
            <dd>
              {openings.length
                ? openings.map((item) => `${ITEM_LABEL[item.kind]} ${wallLetter(item.wall)} ${item.width}`).join(" · ")
                : "Тэмдэглээгүй"}
            </dd>
            <dt>Нүүр</dt>
            <dd>{finishLabel.front}</dd>
            <dt>Тавцан</dt>
            <dd>{finishLabel.countertop}</dd>
            <dt>Модуль</dt>
            <dd>{kitchen.cabinets.length}</dd>
            <dt>Урьдчилсан</dt>
            <dd>
              {bomMoney(view.knownTotal)} + {view.unpriced.length} үнэ тодорхойгүй мөр
            </dd>
          </dl>
        </div>
      </section>
      <section className="kitchen-k-card">
        <h2>Утилити ба нүх</h2>
        {items.length ? (
          <ul className="kitchen-k-utilities">
            {items.map((item) => (
              <li key={item.id}>
                <span aria-hidden="true" data-kind={item.kind}>
                  {ITEM_LABEL[item.kind][0]}
                </span>
                <strong>{ITEM_LABEL[item.kind]}</strong>
                <small>
                  {wallLetter(item.wall)} хана · {item.width} мм
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="kitchen-k-muted">Өрөөнд нүх, утилити тэмдэглээгүй.</p>
        )}
      </section>
      <section className="kitchen-k-card">
        <h2>
          Анхааруулга <span className="kitchen-k-warn-count">{warnings.length}</span>
        </h2>
        {warnings.length ? (
          <ul className="kitchen-k-warnings">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : (
          <p className="kitchen-k-muted">Төлөвлөгөөнөөс анхааруулга гараагүй.</p>
        )}
      </section>
      <section className="kitchen-k-card kitchen-k-wide">
        <h2>Хадгалалт ба экспортын бэлэн байдал</h2>
        <div className="kitchen-k-readiness">
          <div>
            <em data-ok={saved && !conflict}>{conflict ? "Зөрчилтэй" : saved ? "Хадгалсан" : "Хадгалаагүй"}</em>
            <strong>Хувилбар</strong>
            <span>{saved ? `v${revision} бүртгэлд хадгалагдсан.` : "Хэмжилтийн өмнө загвараа хадгална."}</span>
          </div>
          <div>
            <em data-ok={kitchen.cabinets.length > 0}>{kitchen.cabinets.length ? "Бэлэн" : "Модуль алга"}</em>
            <strong>PDF snapshot</strong>
            <span>Хэмжээс, материал, BOM-тэй.</span>
          </div>
          <div>
            <em data-ok={!view.unpriced.length}>{view.unpriced.length ? "Тооцоо дутуу" : "Бэлэн"}</em>
            <strong>Хэмжигчийн хуудас</strong>
            <span>Тавцан, тоног төхөөрөмжийн үнэ хэмжилтээр гарна.</span>
          </div>
        </div>
        <div className="kitchen-k-exports">{exports}</div>
      </section>
    </div>
  );
}

/**
 * K7 panel. A store design forwards to its maker through the real quote API
 * (`quoteRequest`). Otherwise no measurer is registered for any district, so
 * the form validates but cannot send, and says so plainly.
 */
export function KitchenMeasurePanel({
  quoteRequest,
  conflict,
}: {
  quoteRequest: ReactNode;
  conflict: boolean;
}) {
  const [form, setForm] = useState<MeasureForm>({ name: "", phone: "", district: "", slot: "", consent: false });
  const [touched, setTouched] = useState(false);
  const errors = measureFormErrors(form);
  const show = (key: keyof MeasureForm) => (touched ? errors[key] : undefined);
  const set = <K extends keyof MeasureForm>(key: K, value: MeasureForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <div className="kitchen-k-step">
      <div>
        <span className="kitchen-k-eyebrow">Алхам 4</span>
        <strong>Хэмжилтийн хүсэлт</strong>
      </div>
      {conflict && (
        <p className="kitchen-k-banner is-warn" role="alert">
          Хувилбарын зөрчлийг шийдсэний дараа хүсэлт илгээнэ.
        </p>
      )}
      {quoteRequest ? (
        <div className="kitchen-k-quote" aria-disabled={conflict || undefined}>
          <p className="kitchen-k-muted">Энэ загварыг гаргасан үйлдвэр хүсэлтийг хүлээн авч, хэмжилтийн цагаа тантай тохирно.</p>
          {!conflict && quoteRequest}
        </div>
      ) : (
        <form
          className="kitchen-k-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            setTouched(true);
          }}
        >
          <label>
            Нэр
            <input value={form.name} aria-invalid={!!show("name")} onChange={(event) => set("name", event.target.value)} />
          </label>
          {show("name") && <span role="alert" className="kitchen-k-error">{errors.name}</span>}
          <label>
            Утас
            <input
              value={form.phone}
              inputMode="numeric"
              placeholder="8 оронтой"
              aria-invalid={!!show("phone")}
              onChange={(event) => set("phone", event.target.value.replace(/[^\d\s]/g, "").slice(0, 9))}
            />
          </label>
          {show("phone") && <span role="alert" className="kitchen-k-error">{errors.phone}</span>}
          <fieldset>
            <legend>Дүүрэг</legend>
            <div className="kitchen-k-chips">
              {MEASURE_DISTRICTS.map((district) => (
                <button key={district} type="button" aria-pressed={form.district === district} onClick={() => set("district", district)}>
                  {district}
                </button>
              ))}
            </div>
          </fieldset>
          {show("district") && <span role="alert" className="kitchen-k-error">{errors.district}</span>}
          {form.district && (
            <div className="kitchen-k-banner is-warn" role="status">
              <strong>{form.district}: хэмжигч бүртгэгдээгүй</strong>
              <span>
                Хэмжилтийн үйлчилгээ үзүүлэгч холбогдоогүй тул хүсэлт илгээх боломжгүй. PDF snapshot-оо татаж
                үйлдвэрт өгөх, эсвэл <Link href="/kitchens">дэлгүүрийн гал тогооны загвар</Link>-аас эхэлбэл тухайн
                үйлдвэр рүү шууд хүсэлт илгээнэ.
              </span>
            </div>
          )}
          <fieldset>
            <legend>Тохиромжтой цаг</legend>
            <div className="kitchen-k-chips">
              {MEASURE_SLOTS.map((slot) => (
                <button key={slot} type="button" aria-pressed={form.slot === slot} onClick={() => set("slot", slot)}>
                  {slot}
                </button>
              ))}
            </div>
            <small className="kitchen-k-muted">Бодит хуваарь холбогдоогүй — зөвхөн хүсэл илэрхийлнэ.</small>
          </fieldset>
          <label className="kitchen-k-check">
            <input type="checkbox" checked={form.consent} onChange={(event) => set("consent", event.target.checked)} />
            Snapshot (хэмжээс, материал, BOM)-ийг хэмжигчтэй хуваалцахыг зөвшөөрч байна
          </label>
          {show("consent") && <span role="alert" className="kitchen-k-error">{errors.consent}</span>}
          <button type="submit" className="kitchen-k-primary" aria-disabled="true">
            Хүсэлт илгээх
          </button>
          <p className="kitchen-k-muted" role="status">
            {touched && !Object.keys(errors).length
              ? "Маягт зөв бөглөгдсөн. Хэмжигч бүртгэгдээгүй тул хүсэлт илгээгдээгүй, захиалга үүсээгүй."
              : "Хэмжигч холбогдоогүй үед хүсэлт илгээгдэхгүй, захиалга үүсэхгүй."}
          </p>
        </form>
      )}
    </div>
  );
}
