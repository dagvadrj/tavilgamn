"use client";

import { useState } from "react";
import { CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import { CATEGORIES } from "@/lib/catalogCategories";
import {
  IMPORT_COLUMNS,
  IMPORT_MATERIALS,
  importRowStatus,
  type ImportField,
  type ImportPreviewRow,
} from "@/lib/productImport";

export type ImportFilter = "all" | "error" | "warning" | "ok";
const PAGE = 50;
const STATUS = {
  ok: ["Зөв", CircleCheck],
  warning: ["Анхааруулга", TriangleAlert],
  error: ["Алдаатай", CircleX],
} as const;
/** The preview shows the fields people fix most; the rest stay as imported. */
const EDITABLE: ImportField[] = [
  "name",
  "category",
  "price",
  "stock",
  "width",
  "depth",
  "height",
  "material",
];
const label = (key: ImportField) =>
  IMPORT_COLUMNS.find(([field]) => field === key)![1];
const categories = CATEGORIES.filter((c) => c.id !== "kitchen-cabinet");

export function ProductImportTable({
  rows,
  filter,
  onFilter,
  skipped,
  onSkip,
  onEdit,
  disabled,
}: {
  rows: ImportPreviewRow[];
  filter: ImportFilter;
  onFilter: (filter: ImportFilter) => void;
  skipped: Set<number>;
  onSkip: (row: number, skip: boolean) => void;
  onEdit: (row: number, key: ImportField, value: string) => void;
  disabled: boolean;
}) {
  const [page, setPage] = useState(0);
  const counts = { all: rows.length, error: 0, warning: 0, ok: 0 };
  for (const row of rows) counts[importRowStatus(row)]++;
  const visible = rows.filter(
    (row) => filter === "all" || importRowStatus(row) === filter,
  );
  const pages = Math.max(1, Math.ceil(visible.length / PAGE));
  const current = Math.min(page, pages - 1);
  return (
    <div className="product-import-review">
      <div className="product-import-filters" role="group" aria-label="Мөрийн төлөвөөр шүүх">
        {(
          [
            ["all", "Бүгд"],
            ["error", "Алдаатай"],
            ["warning", "Анхааруулга"],
            ["ok", "Зөв"],
          ] as const
        ).map(([value, text]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            data-status={value}
            onClick={() => {
              onFilter(value);
              setPage(0);
            }}
          >
            {text} <span>{counts[value]}</span>
          </button>
        ))}
      </div>
      <div
        className="product-import-table"
        tabIndex={0}
        role="region"
        aria-label="Импортын урьдчилсан шалгалт"
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Мөр</th>
              <th scope="col">Төлөв</th>
              {EDITABLE.map((key) => (
                <th key={key} scope="col">
                  {label(key)}
                </th>
              ))}
              <th scope="col">Алгасах</th>
            </tr>
          </thead>
          <tbody>
            {visible.slice(current * PAGE, (current + 1) * PAGE).map((row) => {
              const status = importRowStatus(row);
              const [text, Icon] = STATUS[status];
              const isSkipped = skipped.has(row.row);
              return (
                <tr key={row.row} data-status={status} data-skipped={isSkipped || undefined}>
                  <th scope="row">{row.row}</th>
                  <td>
                    <span className="product-import-status">
                      <Icon size={15} aria-hidden="true" /> {text}
                    </span>
                    {[...row.errors, ...row.warnings].map((message) => (
                      <small key={message}>
                        {row.row}-р мөр: {message}
                      </small>
                    ))}
                  </td>
                  {EDITABLE.map((key) => {
                    const invalid = row.fields.includes(key);
                    const common = {
                      "aria-label": `${row.row}-р мөр: ${label(key)}`,
                      "aria-invalid": invalid || undefined,
                      value: row.values[key],
                      disabled: disabled || isSkipped,
                      onChange: (event: { target: { value: string } }) =>
                        onEdit(row.row, key, event.target.value),
                    };
                    return (
                      <td key={key} data-invalid={invalid || undefined}>
                        {key === "category" || key === "material" ? (
                          <select {...common}>
                            {!(key === "category"
                              ? categories.some((c) => c.name === row.values[key] || c.id === row.values[key])
                              : IMPORT_MATERIALS.includes(row.values[key])) && (
                              <option value={row.values[key]}>
                                {row.values[key] || "Сонгох…"}
                              </option>
                            )}
                            {(key === "category"
                              ? categories.map((c) => c.name)
                              : IMPORT_MATERIALS
                            ).map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            {...common}
                            inputMode={key === "name" ? undefined : "decimal"}
                          />
                        )}
                      </td>
                    );
                  })}
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`${row.row}-р мөрийг алгасах`}
                      checked={isSkipped}
                      disabled={disabled}
                      onChange={(event) => onSkip(row.row, event.target.checked)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!visible.length && <p className="product-import-empty">Энэ төлөвтэй мөр алга.</p>}
      </div>
      {pages > 1 && (
        <nav className="product-import-pages" aria-label="Мөрийн хуудас">
          <button type="button" className="btn-ghost" disabled={current === 0} onClick={() => setPage(current - 1)}>
            Өмнөх
          </button>
          <span>
            {current + 1} / {pages}
          </span>
          <button type="button" className="btn-ghost" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
            Дараах
          </button>
        </nav>
      )}
    </div>
  );
}
