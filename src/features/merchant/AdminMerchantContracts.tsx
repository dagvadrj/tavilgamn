"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileText, RefreshCw, Save, Send } from "lucide-react";
import { PageSkeleton } from "@/components/PageSkeleton";
import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@/store/auth";
import { CONTRACT_FILE_LIMIT } from "@/lib/merchantContractFiles";
import type {
  AdminContractsData,
  ContractVersion,
} from "@/lib/merchantCommerce";
import { merchantDownload } from "./merchantDownload";
import "./merchant-commerce.css";

type Draft = {
  id?: string;
  revision?: number;
  title: string;
  platformName: string;
};
const draftFrom = (v?: ContractVersion): Draft => ({
  ...(v ? { id: v.id, revision: v.revision } : {}),
  title: v?.title ?? "Хамтран ажиллах гэрээ",
  platformName: v?.platform_name ?? "",
});
export function AdminMerchantContracts({ owner }: { owner: string }) {
  const [storeId, setStoreId] = useState("");
  const [merchants, setMerchants] = useState<
    NonNullable<AdminContractsData["merchants"]>
  >([]);
  const [data, setData] = useState<AdminContractsData | null>(null);
  const [draft, setDraft] = useState<Draft>(() => draftFrom());
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [page, setPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState("load");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const scope = useRef({ owner, storeId });
  scope.current = { owner, storeId };
  const isCurrent = (selected: string) =>
    scope.current.owner === owner &&
    scope.current.storeId === selected &&
    useAuth.getState().user?.id === owner &&
    useAuth.getState().role === "admin";

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setBusy("load");
    setError("");
    const query = new URLSearchParams({ page: String(page) });
    if (storeId) query.set("storeId", storeId);
    void authFetch(
      `/api/admin/merchant-contracts?${query}`,
      { signal: controller.signal },
      owner,
    )
      .then(async (response) => {
        const result: AdminContractsData & { error?: string } =
          await response.json();
        if (!response.ok)
          throw new Error(result.error ?? "Гэрээ ачаалж чадсангүй.");
        if (
          !active ||
          useAuth.getState().user?.id !== owner ||
          useAuth.getState().role !== "admin"
        )
          return;
        setMerchants(result.merchants ?? []);
        setData(result);
        setDraft(draftFrom(result.versions.find((v) => v.status === "draft")));
        setFile(null);
        setFileKey((k) => k + 1);
      })
      .catch((issue) => {
        if (active)
          setError(
            issue instanceof Error ? issue.message : "Гэрээ ачаалж чадсангүй.",
          );
      })
      .finally(() => {
        if (active) setBusy("");
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [owner, storeId, page, retry]);

  const current = data?.storeId === storeId ? data : null;
  const saved = current?.versions.find((v) => v.status === "draft");
  const dirty =
    file !== null || JSON.stringify(draft) !== JSON.stringify(draftFrom(saved));
  const merchant = merchants.find((m) => m.id === storeId);
  const rows = current?.acceptances.slice(0, 50) ?? [];
  const apply = (result: AdminContractsData) => {
    setData(result);
    setMerchants(result.merchants ?? []);
    setDraft(draftFrom(result.versions.find((v) => v.status === "draft")));
    setFile(null);
    setFileKey((k) => k + 1);
  };
  async function run(action: "save" | "publish") {
    if (busy || !storeId) return;
    if (
      action === "publish" &&
      !window.confirm(
        `${merchant?.name ?? "Сонгосон merchant"}-д энэ гэрээг нийтлэх үү? Нийтэлсэн хувилбарыг өөрчлөхгүй.`,
      )
    )
      return;
    const selected = storeId;
    setBusy(action);
    setError("");
    setNotice("");
    try {
      const payload = { ...draft, storeId: selected, action, page };
      let options: RequestInit;
      if (action === "save") {
        const form = new FormData();
        form.set("metadata", JSON.stringify(payload));
        if (file) form.set("file", file);
        options = { method: "POST", body: form };
      } else
        options = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        };
      const response = await authFetch(
        "/api/admin/merchant-contracts",
        options,
        owner,
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Гэрээг хадгалж чадсангүй.");
      if (!isCurrent(selected)) return;
      apply(result);
      setNotice(
        action === "save"
          ? "Гэрээний файл, ноорог хадгалагдлаа."
          : `${merchant?.name ?? "Merchant"}-д гэрээг нийтэллээ.`,
      );
    } catch (issue) {
      if (isCurrent(selected))
        setError(issue instanceof Error ? issue.message : "Хадгалж чадсангүй.");
    } finally {
      if (isCurrent(selected)) setBusy("");
    }
  }
  async function download(version: ContractVersion) {
    if (busy) return;
    const selected = storeId;
    setBusy("download");
    setError("");
    try {
      await merchantDownload(
        `/api/admin/merchant-contracts?${new URLSearchParams({ storeId: selected, file: version.id })}`,
        owner,
        version.file_name ?? "contract.pdf",
      );
    } catch (issue) {
      if (isCurrent(selected))
        setError(
          issue instanceof Error ? issue.message : "Файл татаж чадсангүй.",
        );
    } finally {
      if (isCurrent(selected)) setBusy("");
    }
  }
  return (
    <section className="merchant-commerce">
      <div className="merchant-section-heading">
        <div>
          <h2>Дэлгүүр–платформын гэрээ</h2>
          <p className="merchant-muted">
            Merchant бүрийн гэрээний файлыг тусад нь оруулж нийтэлнэ.
          </p>
        </div>
      </div>
      <label className="merchant-commerce-field merchant-contract-selection">
        Гэрээ байгуулах merchant
        <select
          className="input"
          value={storeId}
          disabled={!!busy}
          onChange={(event) => {
            if (
              dirty &&
              !window.confirm(
                "Хадгалаагүй өөрчлөлтөө орхиод merchant солих уу?",
              )
            )
              return;
            setStoreId(event.target.value);
            setPage(0);
            setData(null);
            setDraft(draftFrom());
            setFile(null);
            setNotice("");
            setError("");
          }}
        >
          <option value="">Дэлгүүр сонгох…</option>
          {merchants.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.active ? "" : " · Идэвхгүй"}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p className="merchant-error" role="alert">
          {error}{" "}
          <button
            type="button"
            className="btn-ghost"
            disabled={!!busy}
            onClick={() => {
              if (
                !dirty ||
                window.confirm(
                  "Хадгалаагүй өөрчлөлтөө орхиод дахин ачаалах уу?",
                )
              )
                setRetry((n) => n + 1);
            }}
          >
            <RefreshCw size={16} /> Дахин ачаалах
          </button>
        </p>
      )}
      {notice && (
        <p className="merchant-success" role="status">
          {notice}
        </p>
      )}
      {busy === "load" && <PageSkeleton compact layout="contract-form" />}
      {!storeId && busy !== "load" && (
        <p className="merchant-muted">
          Гэрээний файл оруулахын өмнө merchant-ээ сонгоно уу.
        </p>
      )}
      {storeId && current && (
        <>
          {merchant?.active ? (
            <form
              className="merchant-commerce merchant-panel"
              onSubmit={(event) => {
                event.preventDefault();
                void run("save");
              }}
            >
              <h3>
                {saved ? `Ноорог · хувилбар ${saved.version_no}` : "Шинэ гэрээ"}{" "}
                · {merchant.name}
              </h3>
              <label className="merchant-commerce-field">
                Гарчиг
                <input
                  className="input"
                  required
                  maxLength={200}
                  value={draft.title}
                  disabled={!!busy}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })
                  }
                />
              </label>
              <label className="merchant-commerce-field">
                Платформын хуулийн этгээдийн нэр
                <input
                  className="input"
                  required
                  maxLength={300}
                  value={draft.platformName}
                  disabled={!!busy}
                  onChange={(e) =>
                    setDraft({ ...draft, platformName: e.target.value })
                  }
                />
              </label>
              <label className="merchant-commerce-field">
                Гэрээний файл
                <input
                  key={fileKey}
                  className="input"
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  required={!saved?.file_path}
                  disabled={!!busy}
                  onChange={(event) => {
                    const next = event.target.files?.[0] ?? null;
                    if (
                      next &&
                      (!next.size || next.size > CONTRACT_FILE_LIMIT)
                    ) {
                      setError("Гэрээний файл 10 MB хүртэл байна.");
                      event.target.value = "";
                      setFile(null);
                      return;
                    }
                    setFile(next);
                    setError("");
                  }}
                />
                <small className="merchant-muted">
                  PDF эсвэл DOCX · 10 MB хүртэл
                </small>
              </label>
              {(file || saved?.file_name) && (
                <div className="merchant-contract-file">
                  <FileText size={22} />
                  <div>
                    <strong>{file?.name ?? saved?.file_name}</strong>
                    <small>
                      {Math.ceil(
                        (file?.size ?? saved?.file_size ?? 0) / 1024,
                      ).toLocaleString("mn-MN")}{" "}
                      KB · {file ? "Хадгалахад орох файл" : "Хадгалсан файл"}
                    </small>
                  </div>
                  {!file && saved && (
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={!!busy}
                      onClick={() => void download(saved)}
                    >
                      <Download size={16} /> Татах
                    </button>
                  )}
                </div>
              )}
              <div className="merchant-commerce-toolbar">
                <button
                  className="btn-primary"
                  disabled={!!busy || (!file && !saved?.file_path)}
                >
                  <Save size={16} />
                  {busy === "save" ? "Хадгалж байна…" : "Ноорог хадгалах"}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={!!busy || !saved?.file_path || dirty}
                  onClick={() => void run("publish")}
                >
                  <Send size={16} />
                  {busy === "publish" ? "Нийтэлж байна…" : "Merchant-д нийтлэх"}
                </button>
              </div>
              <p className="merchant-muted">
                Энэ гэрээг зөвхөн {merchant.name} харж зөвшөөрнө. Нийтэлсэн файл
                болон зөвшөөрлийн түүх өөрчлөгдөхгүй.
              </p>
            </form>
          ) : (
            <p className="merchant-muted">
              Идэвхгүй merchant-ийн гэрээний түүхийг харж байна.
            </p>
          )}
          <h3>Нийтэлсэн гэрээнүүд · {merchant?.name}</h3>
          <ul className="merchant-commerce-history">
            {current.versions
              .filter((v) => v.status === "published")
              .map((v) => (
                <li key={v.id}>
                  <div>
                    <strong>
                      Хувилбар {v.version_no} · {v.title}
                    </strong>
                    <p>
                      {v.file_name ?? v.platform_name} ·{" "}
                      {v.published_at
                        ? new Date(v.published_at).toLocaleDateString("mn-MN", {
                            timeZone: "Asia/Ulaanbaatar",
                          })
                        : ""}
                    </p>
                  </div>
                  {v.file_path && (
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={!!busy}
                      onClick={() => void download(v)}
                    >
                      <Download size={16} /> Файл татах
                    </button>
                  )}
                </li>
              ))}
          </ul>
          {!current.versions.some((v) => v.status === "published") && (
            <p className="merchant-muted">
              Энэ merchant-д нийтэлсэн гэрээ алга.
            </p>
          )}
          <h3>Дэлгүүрийн зөвшөөрлийн бүртгэл</h3>
          <div
            className="merchant-commerce-table"
            tabIndex={0}
            role="region"
            aria-label="Гэрээ зөвшөөрсөн merchant"
          >
            <table>
              <thead>
                <tr>
                  <th>Дэлгүүр</th>
                  <th>Төлөөлөгч</th>
                  <th>Хувилбар</th>
                  <th>Огноо</th>
                  <th>Шимтгэл</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td>{a.store_snapshot.name}</td>
                    <td>{a.signer_name}</td>
                    <td>{a.version_no}</td>
                    <td>
                      {new Date(a.accepted_at).toLocaleString("mn-MN", {
                        timeZone: "Asia/Ulaanbaatar",
                      })}
                    </td>
                    <td>{a.commission_bps / 100}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && (
            <p className="merchant-muted">
              Энэ хуудсанд зөвшөөрлийн бүртгэл алга.
            </p>
          )}
          <div className="merchant-commerce-toolbar">
            <button
              type="button"
              className="btn-ghost"
              disabled={!!busy || dirty || page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Өмнөх
            </button>
            <span>Хуудас {page + 1}</span>
            <button
              type="button"
              className="btn-ghost"
              disabled={!!busy || dirty || current.acceptances.length <= 50}
              onClick={() => setPage((p) => p + 1)}
            >
              Дараах
            </button>
          </div>
        </>
      )}
    </section>
  );
}
