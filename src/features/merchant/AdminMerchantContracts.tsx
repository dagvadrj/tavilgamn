"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Save, Send, RefreshCw } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@/store/auth";
import type {
  AdminContractsData,
  ContractVersion,
} from "@/lib/merchantCommerce";
import "./merchant-commerce.css";
type Draft = {
  id?: string;
  revision?: number;
  title: string;
  platformName: string;
  body: string;
};
const blank = (): Draft => ({
  title: "Хамтран ажиллах гэрээ",
  platformName: "",
  body: "",
});
const draftFrom = (v?: ContractVersion): Draft =>
  v
    ? {
        id: v.id,
        revision: v.revision,
        title: v.title,
        platformName: v.platform_name,
        body: v.body,
      }
    : blank();
export function AdminMerchantContracts({ owner }: { owner: string }) {
  const initializedDraft = useRef(false);
  const [data, setData] = useState<AdminContractsData | null>(null),
    [draft, setDraft] = useState<Draft>(blank),
    [page, setPage] = useState(0),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const apply = useCallback((result: AdminContractsData) => {
    setData(result);
    setDraft(draftFrom(result.versions.find((v) => v.status === "draft")));
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setBusy("load");
    setError("");
    authFetch(
      `/api/admin/merchant-contracts?page=${page}`,
      { signal: controller.signal },
      owner,
    )
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error ?? "Гэрээ ачаалж чадсангүй.");
        if (active && useAuth.getState().user?.id === owner) {
          setData(result);
          if (!initializedDraft.current) {
            initializedDraft.current = true;
            setDraft(
              draftFrom(
                result.versions.find(
                  (v: ContractVersion) => v.status === "draft",
                ),
              ),
            );
          }
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setBusy("");
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [owner, page, apply]);
  const saved = data?.versions.find((v) => v.status === "draft"),
    dirty = JSON.stringify(draft) !== JSON.stringify(draftFrom(saved));
  const run = async (action: "save" | "publish") => {
    if (
      action === "publish" &&
      !window.confirm(
        "Энэ эхийг merchant-үүдэд нийтлэх үү? Нийтэлсний дараа эхийг засахгүй, дараагийн хувилбар үүсгэнэ.",
      )
    )
      return;
    setBusy(action);
    setError("");
    setNotice("");
    try {
      const response = await authFetch(
        "/api/admin/merchant-contracts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...draft, action, page }),
        },
        owner,
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Хадгалж чадсангүй.");
      if (useAuth.getState().user?.id !== owner) return;
      apply(result);
      setNotice(
        action === "save"
          ? "Гэрээний эх хадгалагдлаа."
          : "Гэрээг нийтэллээ. Merchant зөвшөөрөх боломжтой боллоо.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Хадгалж чадсангүй.");
    } finally {
      setBusy("");
    }
  };
  const rows = data?.acceptances.slice(0, 50) ?? [];
  return (
    <section className="merchant-commerce">
      <div className="merchant-section-heading">
        <div>
          <h2>Merchant–платформын гэрээ</h2>
          <p className="merchant-muted">
            Админ баталсан эхээ оруулж нийтэлнэ. Зөвшөөрсөн merchant болон
            гэрээний хувилбарын түүх хадгалагдана.
          </p>
        </div>
      </div>
      {error && (
        <p className="merchant-error" role="alert">
          {error}
          <button
            className="btn-ghost"
            onClick={() => {
              if (
                window.confirm(
                  "Хадгалаагүй өөрчлөлтөө орхиод дахин ачаалах уу?",
                )
              )
                window.location.reload();
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
      <form
        className="merchant-commerce merchant-panel"
        onSubmit={(e) => {
          e.preventDefault();
          void run("save");
        }}
      >
        <h3>
          {saved ? `Ноорог · хувилбар ${saved.version_no}` : "Шинэ гэрээний эх"}
        </h3>
        <label className="merchant-commerce-field">
          Гарчиг
          <input
            className="input"
            required
            maxLength={200}
            value={draft.title}
            disabled={!!busy}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
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
          Баталсан гэрээний эх
          <textarea
            className="input merchant-contract-editor"
            required
            maxLength={100000}
            value={draft.body}
            disabled={!!busy}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          />
        </label>
        <div className="merchant-commerce-toolbar">
          <button className="btn-primary" disabled={!!busy || !data}>
            <Save size={16} />{" "}
            {busy === "save" ? "Хадгалж байна…" : "Ноорог хадгалах"}
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={!!busy || !saved || dirty}
            onClick={() => void run("publish")}
          >
            <Send size={16} />{" "}
            {busy === "publish" ? "Нийтэлж байна…" : "Хадгалсан эхийг нийтлэх"}
          </button>
        </div>
        <p className="merchant-muted">
          Нийтэлсэн эх өөрчлөгдөхгүй. Шинэ хувилбар гаргахад өмнөх зөвшөөрлийн
          бүртгэл хэвээр үлдэнэ.
        </p>
      </form>
      <h3>Нийтэлсэн хувилбарууд</h3>
      <ul className="merchant-commerce-history">
        {data?.versions
          .filter((v) => v.status === "published")
          .map((v) => (
            <li key={v.id}>
              <details>
                <summary>
                  Хувилбар {v.version_no} · {v.title} ·{" "}
                  {v.published_at
                    ? new Date(v.published_at).toLocaleDateString("mn-MN")
                    : ""}
                </summary>
                <p>{v.platform_name}</p>
                <div className="merchant-contract-body">{v.body}</div>
              </details>
            </li>
          ))}
      </ul>
      <h3>Merchant-ийн зөвшөөрлийн бүртгэл</h3>
      <div
        className="merchant-commerce-table"
        tabIndex={0}
        role="region"
        aria-label="Гэрээ зөвшөөрсөн merchant-үүд"
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
                <td>{new Date(a.accepted_at).toLocaleString("mn-MN")}</td>
                <td>{a.commission_bps / 100}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && !rows.length && <p>Энэ хуудсанд зөвшөөрлийн бүртгэл алга.</p>}
      <div className="merchant-commerce-toolbar">
        <button
          className="btn-ghost"
          disabled={!!busy || page === 0}
          onClick={() => setPage((p) => p - 1)}
        >
          Өмнөх
        </button>
        <span>Хуудас {page + 1}</span>
        <button
          className="btn-ghost"
          disabled={!!busy || (data?.acceptances.length ?? 0) <= 50}
          onClick={() => setPage((p) => p + 1)}
        >
          Дараах
        </button>
      </div>
    </section>
  );
}
