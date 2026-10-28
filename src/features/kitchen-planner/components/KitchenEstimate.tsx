"use client";
import { useMemo, useState } from "react";
import type { KitchenBom } from "@/lib/kitchenBom";
import {
  BOM_SOURCE_LABEL,
  bomMoney,
  presentKitchenBom,
} from "@/lib/kitchenWorkspace";

/**
 * K6 contents card: every BOM row with its source. Included parts show as
 * «Багтсан» and add nothing; a row without a known price is never summed.
 */
export function KitchenBomTable({ bom }: { bom: KitchenBom }) {
  const view = useMemo(() => presentKitchenBom(bom), [bom]);
  const [showIncluded, setShowIncluded] = useState(true);
  const rows = showIncluded ? view.rows : view.rows.filter((row) => !row.included);
  return (
    <section className="kitchen-k-card kitchen-k-bom" aria-labelledby="kitchen-k-bom-title">
      <header>
        <div>
          <h1 id="kitchen-k-bom-title">Материалын жагсаалт (BOM)</h1>
          <p>Сонгосон модуль, материал, тоноглолоос гаргав. Багтсан эд анги давхар үнэлэгдэхгүй.</p>
        </div>
        <button type="button" aria-pressed={showIncluded} onClick={() => setShowIncluded((value) => !value)}>
          Багтсан эд анги
        </button>
      </header>
      <div className="kitchen-k-table" role="table" aria-label="Материалын жагсаалт">
        <div role="row" className="is-head">
          {["Эд анги", "Хэмжээ", "Төрөл", "Тоо", "Өгөгдөл", "Нэгж үнэ", "Дүн"].map((label) => (
            <span key={label} role="columnheader">
              {label}
            </span>
          ))}
        </div>
        {rows.map((row) => (
          <div role="row" key={row.id} data-source={row.source} data-unpriced={(!row.included && row.unitPrice === null) || undefined}>
            <span role="cell">
              <strong>{row.label}</strong>
              <small>{row.material}</small>
            </span>
            <span role="cell">{row.dimensions}</span>
            <span role="cell">{row.kind}</span>
            <span role="cell">
              {row.quantity} {row.unit}
            </span>
            <span role="cell">
              <em data-source={row.source}>{BOM_SOURCE_LABEL[row.source]}</em>
            </span>
            <span role="cell">{row.included ? "Багтсан" : bomMoney(row.unitPrice)}</span>
            <span role="cell">
              {row.included ? "—" : row.total === null ? "Тооцоо дутуу" : bomMoney(row.total)}
            </span>
          </div>
        ))}
        {!rows.length && (
          <div role="row">
            <span role="cell" className="kitchen-k-empty">
              Модуль нэмээгүй байна.
            </span>
          </div>
        )}
      </div>
      <footer>
        <span>
          Actual = каталогийн бараа. Sample = каталогт холбоогүй стандарт модуль. Тооцоолсон = өрөөний хэмжээнээс гаргасан.
          Нөөц, хүргэлт, угсралтын мэдээлэл холбогдоогүй.
        </span>
        <div>
          <small>Мэдэгдэж буй дүн</small>
          <strong>{bomMoney(view.knownTotal)}</strong>
        </div>
        <div className="is-warn">
          <small>Үнэ тодорхойгүй мөр</small>
          <strong>{view.unpriced.length}</strong>
        </div>
      </footer>
    </section>
  );
}

/** K6 left panel: the known subtotal and what is still unpriced. */
export function KitchenEstimatePanel({
  bom,
  onMeasure,
  onDesign,
  measureDisabled,
}: {
  bom: KitchenBom;
  onMeasure: () => void;
  onDesign: () => void;
  measureDisabled: boolean;
}) {
  const view = useMemo(() => presentKitchenBom(bom), [bom]);
  const priced = view.rows.filter((row) => !row.included && row.unitPrice !== null).length;
  return (
    <div className="kitchen-k-step">
      <div>
        <span className="kitchen-k-eyebrow">Алхам 3</span>
        <strong>Урьдчилсан үнэ</strong>
      </div>
      <div className="kitchen-k-total">
        <small>Мэдэгдэж буй дэд дүн</small>
        <strong>{bomMoney(view.knownTotal)}</strong>
        <small>
          {priced} мөр үнэтэй · {view.includedCount} багтсан мөр давхар тооцоогүй
        </small>
      </div>
      {view.unpriced.length > 0 && (
        <div className="kitchen-k-banner is-warn" role="status">
          <strong>Тооцоо дутуу · {view.unpriced.length} үнэ тодорхойгүй мөр</strong>
          <ul>
            {view.unpriced.slice(0, 6).map((row) => (
              <li key={row.id}>{row.label}</li>
            ))}
            {view.unpriced.length > 6 && <li>… бас {view.unpriced.length - 6}</li>}
          </ul>
        </div>
      )}
      <p className="kitchen-k-muted">
        Энэ бол үнийн санал биш. Нийлүүлэгчийн нөөц, хүргэлт холбогдоогүй. Тавцангийн үнэ бодит хэмжилтээр гарна.
      </p>
      <button type="button" className="kitchen-k-primary" disabled={measureDisabled} onClick={onMeasure}>
        Хэмжилт рүү үргэлжлүүлэх
      </button>
      <button type="button" className="kitchen-k-secondary" onClick={onDesign}>
        Тохижуулах руу буцах
      </button>
    </div>
  );
}
