"use client";
import { useEffect, useState } from "react";
import { Download, Check } from "lucide-react";
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
      await merchantDownload(
        "/api/merchant/contracts?format=pdf" + (id ? `&acceptance=${id}` : ""),
        owner,
        "merchant-contract.pdf",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Файлыг татаж чадсангүй.");
    } finally {
      setBusy("");
    }
  };
  return (
    <section className="merchant-commerce">
      <h2>Платформтой байгуулах гэрээ</h2>
      {(resource.error || error) && (
        <p role="alert" className="merchant-error">
          {error || resource.error}
          <button className="btn-ghost" onClick={resource.refresh}>
            Дахин ачаалах
          </button>
        </p>
      )}
      {resource.loading && !resource.data && (
        <p role="status">Гэрээг ачаалж байна…</p>
      )}
      {resource.data && !contract && (
        <div className="merchant-panel">
          <h3>Гэрээ нийтлэгдээгүй байна</h3>
          <p>
            Платформын админ баталсан гэрээний эхийг нийтэлсний дараа энд уншиж
            зөвшөөрнө.
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
              <Download size={16} /> PDF татах
            </button>
          </div>
          <div
            className="merchant-contract-body"
            tabIndex={0}
            role="region"
            aria-label="Гэрээний эх"
          >
            {contract.body}
          </div>
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
                disabled={!!busy || !consent || signer.trim().length < 2}
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
                  PDF татах
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
