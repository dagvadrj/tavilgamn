"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  CircleCheck,
  Download,
  FileSpreadsheet,
  RotateCcw,
  Upload,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@/store/auth";
import {
  IMPORT_BYTES,
  IMPORT_CHUNK,
  normalizeProductName,
  type ImportCommitResult,
  type ImportPreviewRow,
} from "@/lib/productImport";
import { ProductImportTable, type ImportFilter } from "./ProductImportTable";
import "./product-import.css";

type Summary = { added: number; skipped: number; failed: number };

/** Excel-first bulk import shared by the merchant and admin product pages. */
export function ProductImportFlow({
  owner,
  endpoint,
  existingNames,
  storeId,
  storePicker,
  onImported,
  onClose,
  onMissingImages,
}: {
  owner: string;
  endpoint: string;
  /** Names already in the target store, for the duplicate choice. */
  existingNames: string[];
  /** Admin only: the store the rows are imported for. */
  storeId?: string;
  storePicker?: ReactNode;
  onImported: () => void;
  onClose: () => void;
  onMissingImages?: () => void;
}) {
  const [rows, setRows] = useState<ImportPreviewRow[] | null>(null);
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [duplicates, setDuplicates] = useState<"skip" | "create">("skip");
  const [filter, setFilter] = useState<ImportFilter>("all");
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [dirty, setDirty] = useState(false);
  const requestId = useRef(crypto.randomUUID());
  // Stable ID per set of rows: a retry after a lost response replays instead of
  // importing twice, and an edited retry is refused by the server, not duplicated.
  const chunkIds = useRef(new Map<string, string>());
  const saved = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const existing = useMemo(
    () => new Set(existingNames.map(normalizeProductName)),
    [existingNames],
  );
  const isDuplicate = useCallback(
    (row: ImportPreviewRow) => existing.has(normalizeProductName(row.values.name)),
    [existing],
  );
  const view = useMemo(
    () =>
      rows?.map((row) =>
        isDuplicate(row)
          ? {
              ...row,
              warnings: [
                ...row.warnings,
                duplicates === "skip"
                  ? "Ийм нэртэй бараа аль хэдийн байгаа тул алгасна."
                  : "Ийм нэртэй бараа байгаа ч шинээр нэмнэ.",
              ],
            }
          : row,
      ) ?? null,
    [rows, isDuplicate, duplicates],
  );
  const ready =
    view?.filter(
      (row) =>
        !row.errors.length &&
        !skipped.has(row.row) &&
        !(duplicates === "skip" && isDuplicate(row)),
    ) ?? [];
  const errorCount = view?.filter((row) => row.errors.length).length ?? 0;

  async function send(body: BodyInit, json: boolean) {
    const response = await authFetch(
      endpoint,
      {
        method: "POST",
        body,
        headers: json ? { "Content-Type": "application/json" } : undefined,
      },
      owner,
    );
    if (useAuth.getState().user?.id !== owner)
      throw new Error("Нэвтрэлт өөрчлөгдсөн байна. Дахин нэвтэрнэ үү.");
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error ?? "Хүсэлт амжилтгүй боллоо. Дахин оролдоно уу.");
    }
    return response;
  }
  const payload = (mode: string, list: ImportPreviewRow[], id = requestId.current) =>
    JSON.stringify({
      mode,
      requestId: id,
      storeId,
      rows: list.map(({ row, values }) => ({ row, values })),
    });
  async function run(label: string, task: () => Promise<void>) {
    if (busy) return;
    setBusy(label);
    setError("");
    try {
      await task();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Алдаа гарлаа.");
    } finally {
      setBusy("");
    }
  }
  async function save(response: Response, name: string) {
    const url = URL.createObjectURL(await response.blob()),
      link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  const downloadTemplate = () =>
    run("template", async () => {
      const response = await authFetch(endpoint, undefined, owner);
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Загвар татаж чадсангүй.");
      }
      await save(response, "baraa-import-zagvar.xlsx");
    });
  const downloadErrors = () =>
    run("errors", async () =>
      save(
        await send(payload("errors", view!.filter((row) => row.errors.length)), true),
        "baraa-aldaatai-moruud.xlsx",
      ),
    );
  function reset() {
    setRows(null);
    setSkipped(new Set());
    setSummary(null);
    setFilter("all");
    setDirty(false);
    requestId.current = crypto.randomUUID();
    chunkIds.current.clear();
    saved.current = 0;
  }
  function choose(file: File | undefined) {
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name) || file.size > IMPORT_BYTES) {
      setError("5 MB хүртэл .xlsx файл сонгоно уу. .xls/.csv бол Excel-д .xlsx болгон хадгална уу.");
      return;
    }
    reset();
    setFileName(file.name);
    void run("preview", async () => {
      const form = new FormData();
      form.set("file", file);
      form.set("requestId", requestId.current);
      const data = (await (await send(form, false)).json()) as {
        rows: ImportPreviewRow[];
      };
      setRows(data.rows);
      setFilter(data.rows.some((row) => row.errors.length) ? "error" : "all");
    });
  }
  const edit = (rowNo: number, key: keyof ImportPreviewRow["values"], value: string) => {
    setDirty(true);
    setRows((current) =>
      current?.map((row) =>
        row.row === rowNo
          ? { ...row, values: { ...row.values, [key]: value } }
          : row,
      ) ?? null,
    );
  };
  const revalidate = () =>
    run("validate", async () => {
      if (!rows) return;
      const data = (await (await send(payload("validate", rows), true)).json()) as {
        rows: ImportPreviewRow[];
      };
      setRows(data.rows);
      setDirty(false);
    });
  const commit = () =>
    run("commit", async () => {
      if (dirty) throw new Error("Засварласан мөрүүдийг эхлээд «Дахин шалгах» товчоор шалгана уу.");
      if (storePicker && !storeId) throw new Error("Аль дэлгүүрийн нэрийн өмнөөс оруулахаа сонгоно уу.");
      for (let start = 0; start < ready.length; start += IMPORT_CHUNK) {
        setBusy(`commit:${start}`);
        const chunk = ready.slice(start, start + IMPORT_CHUNK);
        const key = chunk.map((row) => row.row).join(",");
        if (!chunkIds.current.has(key)) chunkIds.current.set(key, crypto.randomUUID());
        const result = (await (
          await send(payload("commit", chunk, chunkIds.current.get(key)), true)
        ).json()) as ImportCommitResult;
        saved.current += result.count;
        // Saved rows leave the review, so a later retry only sends what is left.
        const done = new Set(chunk.map((row) => row.row));
        setRows((current) => current?.filter((row) => !done.has(row.row)) ?? null);
        onImported();
      }
      setSummary({
        added: saved.current,
        skipped: view!.length - ready.length - errorCount,
        failed: errorCount,
      });
    });

  if (summary)
    return (
      <section className="product-import" aria-labelledby="product-import-heading">
        <div className="product-import-summary" role="status">
          <CircleCheck size={36} aria-hidden="true" />
          <h2 id="product-import-heading">{summary.added} бараа нэмэгдлээ</h2>
          <dl>
            <div><dt>Нэмэгдсэн</dt><dd>{summary.added}</dd></div>
            <div><dt>Алгассан</dt><dd>{summary.skipped}</dd></div>
            <div><dt>Алдаатай</dt><dd>{summary.failed}</dd></div>
          </dl>
          {error && <p className="product-import-error" role="alert">{error}</p>}
          <div className="product-import-actions">
            {onMissingImages && (
              <button type="button" className="btn-primary" onClick={onMissingImages}>
                Зураг нэмэх
              </button>
            )}
            {summary.failed > 0 && (
              <button
                type="button"
                className="btn-ghost"
                disabled={!!busy}
                onClick={downloadErrors}
              >
                <Download size={16} /> Алдаатай мөрүүдийг Excel-ээр татах
              </button>
            )}
            <button type="button" className="btn-ghost" onClick={reset}>
              Өөр файл оруулах
            </button>
            <button type="button" className="btn-ghost" onClick={onClose}>
              Жагсаалт руу буцах
            </button>
          </div>
        </div>
      </section>
    );

  const committing = busy.startsWith("commit");
  return (
    <section className="product-import" aria-labelledby="product-import-heading">
      <header className="product-import-heading">
        <button type="button" className="btn-ghost" onClick={onClose} disabled={committing}>
          <ArrowLeft size={16} /> Буцах
        </button>
        <div>
          <h1 id="product-import-heading">Excel-ээр бараа оруулах</h1>
          <p>Олон барааг нэг дор: загвар татаж бөглөөд, энд чирж оруулна.</p>
        </div>
      </header>
      {storePicker}
      <ol className="product-import-steps">
        <li data-done={rows ? "" : undefined}>
          <span>1</span>
          <div>
            <strong>Загвар татах</strong>
            <small>Улбар шар толгойтой баганыг заавал бөглөнө.</small>
          </div>
          <button
            type="button"
            className="btn-ghost"
            disabled={!!busy}
            onClick={downloadTemplate}
          >
            <FileSpreadsheet size={16} />
            {busy === "template" ? "Татаж байна…" : "Загвар татах"}
          </button>
        </li>
        <li data-done={rows ? "" : undefined}>
          <span>2</span>
          <div
            className="product-import-drop"
            data-dragging={dragging || undefined}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              choose(event.dataTransfer.files[0]);
            }}
          >
            <Upload size={22} aria-hidden="true" />
            <strong>
              {busy === "preview"
                ? "Шалгаж байна…"
                : fileName || "Excel файлаа энд чирж оруулна уу"}
            </strong>
            <small>.xlsx · 5 MB · 500 мөр хүртэл</small>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              aria-label="Excel файл сонгох"
              hidden
              onChange={(event) => {
                choose(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              className="btn-ghost"
              disabled={!!busy}
              onClick={() => inputRef.current?.click()}
            >
              Файл сонгох
            </button>
          </div>
        </li>
        <li data-active={view ? "" : undefined}>
          <span>3</span>
          <div>
            <strong>Шалгаад хадгалах</strong>
            <small>
              {view
                ? `${view.length} мөр · ${ready.length} хадгалахад бэлэн · ${errorCount} алдаатай`
                : "Файл оруулсны дараа мөр бүрийн төлөв энд гарна."}
            </small>
          </div>
        </li>
      </ol>
      {error && (
        <p className="product-import-error" role="alert">
          {error}
        </p>
      )}
      {view && (
        <>
          <fieldset className="product-import-duplicates">
            <legend>Ижил нэртэй бараа байвал</legend>
            {(
              [
                ["skip", "Алгасах"],
                ["create", "Шинээр нэмэх"],
              ] as const
            ).map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="import-duplicates"
                  checked={duplicates === value}
                  onChange={() => setDuplicates(value)}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <ProductImportTable
            rows={view}
            filter={filter}
            onFilter={setFilter}
            skipped={skipped}
            onSkip={(rowNo, skip) =>
              setSkipped((current) => {
                const next = new Set(current);
                if (skip) next.add(rowNo);
                else next.delete(rowNo);
                return next;
              })
            }
            onEdit={edit}
            disabled={!!busy}
          />
          <div className="product-import-bar">
            <span role="status">
              {committing
                ? `Хадгалж байна… ${busy.slice(7)}/${ready.length}`
                : dirty
                  ? "Засвар хийгдсэн — дахин шалгана уу."
                  : `${ready.length} бараа хадгалахад бэлэн`}
            </span>
            {errorCount > 0 && (
              <button
                type="button"
                className="btn-ghost"
                disabled={!!busy}
                onClick={downloadErrors}
              >
                <Download size={16} /> Алдаатай мөрүүд
              </button>
            )}
            {dirty && (
              <button type="button" className="btn-ghost" disabled={!!busy} onClick={revalidate}>
                <RotateCcw size={16} />
                {busy === "validate" ? "Шалгаж байна…" : "Дахин шалгах"}
              </button>
            )}
            <button
              type="button"
              className="btn-primary"
              disabled={!!busy || dirty || !ready.length}
              onClick={commit}
            >
              {committing ? "Хадгалж байна…" : `${ready.length} бараа хадгалах`}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

