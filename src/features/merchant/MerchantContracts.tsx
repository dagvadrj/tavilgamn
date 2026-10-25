"use client";
import { PageSkeleton } from "@/components/PageSkeleton";
import { useEffect, useState } from "react";
import { Download, Check, FileText, RefreshCw } from "lucide-react";
import { merchantRequest } from "./merchantApi";
import { useMerchantResource } from "./useMerchantResource";
import { merchantDownload } from "./merchantDownload";
import type { MerchantContractsData } from "@/lib/merchantCommerce";
import "./merchant-commerce.css";
export function MerchantContracts({ owner }: { owner: string }) {
  const resource = useMerchantResource<MerchantContractsData>(
    owner,
    "/api/merchant/contracts",
  );
  const [signer, setSigner] = useState(""),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const contract = resource.data?.current,
    acceptance = resource.data?.acceptances.find(
      (item) => item.contract.id === contract?.id,
    )?.acceptance;
  useEffect(() => {
    setConsent(false);
    setError("");
  }, [contract?.id]);
  const download = async (id?: string) => {
    setBusy("download");
    setError("");
    try {
      const version = id
        ? resource.data?.acceptances.find((item) => item.acceptance.id === id)
            ?.contract
        : contract;
      await merchantDownload(
        `/api/merchant/contracts?format=${version?.file_path ? "file" : "pdf"}` +
          (id ? `&acceptance=${id}` : ""),
        owner,
        version?.file_name ?? "merchant-contract.pdf",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Файлыг татаж чадсангүй.");
    } finally {
      setBusy("");
    }
  };
  return (
    <section className="merchant-commerce">
      <div className="merchant-section-heading">
        <h2>Платформтой байгуулах гэрээ</h2>
        <button
          type="button"
          className="btn-ghost"
          disabled={!!busy || resource.loading}
          onClick={resource.refresh}
        >
          <RefreshCw size={16} /> Шинэчлэх
        </button>
      </div>
      {(resource.error || error) && (
        <p role="alert" className="merchant-error">
          {error || resource.error}
          <button className="btn-ghost" onClick={resource.refresh}>
            Дахин ачаалах
          </button>
        </p>
      )}
      {resource.loading && !resource.data && (
        <PageSkeleton compact layout="document" />
      )}
      {resource.data && !contract && (
        <div className="merchant-panel">
          <h3>Гэрээ нийтлэгдээгүй байна</h3>
          <p>
            Админ таны дэлгүүрт зориулсан гэрээний файлыг нийтэлсний дараа энд
            татаж уншаад зөвшөөрнө.
          </p>
        </div>
      )}
      {contract && (
        <>
          <div className="merchant-section-heading">
            <div>
              <h3>{contract.title}</h3>
              <p>
                {contract.platform_name} · Хувилбар {contract.version_no}
              </p>
            </div>
            <button
              className="btn-ghost"
              disabled={!!busy}
              onClick={() => void download()}
            >
              <Download size={16} />{" "}
              {contract.file_path ? "Гэрээний файл татах" : "PDF татах"}
            </button>
          </div>
          {contract.file_path ? (
            <div className="merchant-contract-file">
              <FileText size={24} />
              <div>
                <strong>{contract.file_name}</strong>
                <small>
                  {Math.ceil((contract.file_size ?? 0) / 1024).toLocaleString(
                    "mn-MN",
                  )}{" "}
                  KB ·{" "}
                  {contract.file_type === "application/pdf" ? "PDF" : "DOCX"}
                </small>
                <p>Гэрээний файлыг татаж уншаад доорх зөвшөөрлийг өгнө үү.</p>
              </div>
            </div>
          ) : (
            <div
              className="merchant-contract-body"
              tabIndex={0}
              role="region"
              aria-label="Гэрээний эх"
            >
              {contract.body}
            </div>
          )}
          {acceptance ? (
            <p className="merchant-success" role="status">
              <Check size={16} /> {acceptance.signer_name} ·{" "}
              {new Date(acceptance.accepted_at).toLocaleString("mn-MN")} ·
              Зөвшөөрсөн
            </p>
          ) : (
            <form
              key={contract.id}
              className="merchant-commerce"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy("accept");
                setError("");
                try {
                  await merchantRequest("/api/merchant/contracts", owner, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      contractId: contract.id,
                      signerName: signer,
                      consent,
                    }),
                  });
                  setConsent(false);
                  resource.refresh();
                } catch (reason) {
                  setError(
                    reason instanceof Error
                      ? reason.message
                      : "Зөвшөөрлийг хадгалж чадсангүй.",
                  );
                } finally {
                  setBusy("");
                }
              }}
            >
              <label className="merchant-commerce-field">
                Дэлгүүрийг төлөөлөх эрх бүхий хүний нэр
                <input
                  className="input"
                  required
                  minLength={2}
                  maxLength={200}
                  value={signer}
                  onChange={(e) => setSigner(e.target.value)}
                />
              </label>
              <label className="merchant-commerce-consent">
                <input
                  type="checkbox"
                  required
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />{" "}
                Би энэ хувилбарын гэрээг уншиж, дэлгүүрээ төлөөлөн зөвшөөрч
                байна.
              </label>
              <p className="merchant-muted">
                Зөвшөөрөл нь таны бүртгэл, нэр, огноо, гэрээний хувилбартай
                хадгалагдана. Тоон гарын үсгийн үйлчилгээтэй холбогдоогүй.
              </p>
              <button
                className="btn-primary"
                disabled={
                  !!busy ||
                  resource.loading ||
                  !consent ||
                  signer.trim().length < 2
                }
              >
                {busy === "accept" ? "Хадгалж байна…" : "Гэрээг зөвшөөрөх"}
              </button>
            </form>
          )}
        </>
      )}
      {!!resource.data?.acceptances.length && (
        <>
          <h3>Зөвшөөрсөн гэрээний түүх</h3>
          <ul className="merchant-commerce-history">
            {resource.data.acceptances.map((item) => (
              <li key={item.acceptance.id}>
                <div>
                  <strong>
                    Хувилбар {item.contract.version_no} · {item.contract.title}
                  </strong>
                  <p>
                    {item.acceptance.signer_name} ·{" "}
                    {new Date(item.acceptance.accepted_at).toLocaleDateString(
                      "mn-MN",
                    )}
                  </p>
                </div>
                <button
                  className="btn-ghost"
                  disabled={!!busy}
                  onClick={() => void download(item.acceptance.id)}
                >
                  {item.contract.file_path
                    ? "Гэрээний файл татах"
                    : "PDF татах"}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
