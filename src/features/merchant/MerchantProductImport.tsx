"use client";
import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { merchantRequest, isOwner } from "./merchantApi";
import { merchantDownload } from "./merchantDownload";
import { DeliveryDialog } from "./DeliveryStaffDialog";
import type { ImportRow } from "@/lib/merchantExcel";
import "./merchant-commerce.css";
type Preview = {
  valid: boolean;
  hash: string;
  rows: Omit<ImportRow, "product">[];
};
export function MerchantProductImport({
  owner,
  onImported,
  onClose,
}: {
  owner: string;
  onImported: () => void;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const requestId = useRef(crypto.randomUUID());
  const run = async (mode: "preview" | "commit") => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("mode", mode);
      form.set("requestId", requestId.current);
      if (preview) form.set("hash", preview.hash);
      // merchantRequest retains owner checks before and after the request.
      const result = await merchantRequest<
        Preview & { count: number; replayed: boolean }
      >("/api/merchant/products/import", owner, { method: "POST", body: form });
      if (mode === "preview") setPreview(result);
      else {
        setSuccess(
          result.replayed
            ? `Энэ файл өмнө нь импортлогдсон: ${result.count} бараа. Давхар нэмээгүй.`
            : `${result.count} барааг импортоллоо.`,
        );
        setPreview(null);
        setFile(null);
        onImported();
      }
    } catch (reason) {
      if (isOwner(owner))
        setError(
          reason instanceof Error ? reason.message : "Импорт амжилтгүй боллоо.",
        );
    } finally {
      setBusy(false);
    }
  };
  return (
    <DeliveryDialog
      title="Excel-ээс бараа импортлох"
      busy={busy}
      onClose={onClose}
    >
      <div className="merchant-commerce">
        <p>
          1. Загвараа татна. 2. Өөрийн бараагаар бөглөнө. 3. Шалгаж хараад
          импортлоно.
        </p>
        <p className="merchant-muted">
          .xlsx · 5 MB · 500 мөр хүртэл · Хэмжээ сантиметрээр. Зөвхөн шинэ бараа
          нэмнэ. Зураг, 3D болон нэмэлт өнгийг дараа нь засаж болно.
        </p>
        <button
          className="btn-ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await merchantDownload(
                "/api/merchant/products/import",
                owner,
                "baraa-import-zagvar.xlsx",
              );
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Загвар татаж чадсангүй.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <Download size={16} /> Загвар Excel татах
        </button>
        <label className="merchant-commerce-field">
          Excel файл
          <input
            type="file"
            aria-label="Excel файл"
            accept=".xlsx"
            disabled={busy}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(null);
              setError("");
              setSuccess("");
              requestId.current = crypto.randomUUID();
            }}
          />
        </label>
        {file && (
          <button
            className="btn-primary"
            disabled={busy}
            onClick={() => void run("preview")}
          >
            <Upload size={16} />
            {busy ? "Шалгаж байна…" : "Файлыг шалгах"}
          </button>
        )}
        {error && (
          <p className="merchant-error" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="merchant-success" role="status">
            {success}
          </p>
        )}
        {preview && (
          <>
            <p role="status">
              {preview.rows.length} мөр ·{" "}
              {preview.rows.filter((r) => r.errors.length).length} алдаатай.{" "}
              {preview.valid
                ? "Импортлоход бэлэн."
                : "Алдаатай мөрүүдийг Excel дээр засаад файлаа дахин сонгоно уу."}
            </p>
            <div
              className="merchant-commerce-table"
              tabIndex={0}
              role="region"
              aria-label="Импортын урьдчилсан шалгалт"
            >
              <table>
                <thead>
                  <tr>
                    <th>Мөр</th>
                    <th>Бараа</th>
                    <th>Ангилал</th>
                    <th>Үнэ (₮)</th>
                    <th>Шалгалт</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.row}>
                      <td>{row.row}</td>
                      <td>{row.name || "Нэргүй"}</td>
                      <td>{row.category}</td>
                      <td>{row.price?.toLocaleString("mn-MN") ?? "—"}</td>
                      <td>{row.errors.join(" ") || "Зөв"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className="btn-primary"
              disabled={busy || !preview.valid}
              onClick={() => void run("commit")}
            >
              {busy ? "Импортолж байна…" : `${preview.rows.length} бараа нэмэх`}
            </button>
          </>
        )}
      </div>
    </DeliveryDialog>
  );
}
