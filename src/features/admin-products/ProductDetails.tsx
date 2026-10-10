"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, Box, RefreshCw } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { formatPrice } from "@/lib/format";
import { stockLabel } from "@/lib/inventory";
import { productSpecificationRows } from "@/lib/productSpecifications";
import type { Product } from "@/lib/types";
import type { ProductModelVersion } from "@/lib/productModelHistory";
import "./product-details.css";

const Preview = dynamic(() => import("./HistoryGlbPreview"), { ssr: false });
type Details = {
  product: Product;
  createdAt: string;
  updatedAt: string;
  processingStatus: string;
  processingError: string | null;
  archivedAt: string | null;
  versions: ProductModelVersion[];
};
const date = (value: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value;
  return `${part("year")}.${part("month")}.${part("day")} ${part("hour")}:${part("minute")}`;
};
const status = {
  current: "Одоогийн загвар",
  published: "Өмнөх хувилбар",
  incomplete: "Дутуу upload",
  deleted: "Дутуу upload · цэвэрлэгдсэн",
};
export function ProductDetails({
  productId,
  owner,
  scope,
  close,
}: {
  productId: string;
  owner: string;
  scope: "admin" | "merchant";
  close: () => void;
}) {
  const [details, setDetails] = useState<Details | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const endpoint = `/api/${scope}/products/${encodeURIComponent(productId)}/details`;
  useEffect(() => {
    heading.current?.focus();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void authFetch(
      endpoint,
      { signal: controller.signal, cache: "no-store" },
      owner,
    )
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data?.error ?? "Дэлгэрэнгүй мэдээлэл ачаалсангүй.");
        if (controller.signal.aborted) return;
        setDetails(data);
        setSelectedId((current) =>
          data.versions.some(
            (version: ProductModelVersion) =>
              version.id === current && version.assetId,
          )
            ? current
            : (data.versions.find(
                (version: ProductModelVersion) => version.assetId,
              )?.id ?? null),
        );
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Дэлгэрэнгүй мэдээлэл ачаалсангүй.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [endpoint, owner, refresh]);
  const selected = details?.versions.find(
    (version) => version.id === selectedId,
  );
  return (
    <section
      className="product-details"
      aria-labelledby="product-details-heading"
    >
      <div className="product-details-heading">
        <button type="button" className="btn-ghost" onClick={close}>
          <ArrowLeft size={16} /> Жагсаалт руу буцах
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={loading}
          onClick={() => setRefresh((value) => value + 1)}
        >
          <RefreshCw size={16} /> Шинэчлэх
        </button>
      </div>
      <h2 id="product-details-heading" ref={heading} tabIndex={-1}>
        {details?.product.name ?? "Бүтээгдэхүүний дэлгэрэнгүй"}
      </h2>
      {loading && <p role="status">Мэдээлэл ачаалж байна…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && details && (
        <>
          <div className="product-details-information">
            <section
              className="product-details-card"
              aria-labelledby="product-details-info-heading"
            >
              <h3 id="product-details-info-heading">Бүтээгдэхүүний мэдээлэл</h3>
              <p className="product-details-description">
                {details.product.description || "Тайлбар оруулаагүй."}
              </p>
              <dl className="product-details-rows">
                {[
                  {
                    label: "Үндсэн үнэ",
                    value: formatPrice(details.product.basePrice),
                  },
                  { label: "Нөөц", value: stockLabel(details.product) },
                  { label: "Бүтээгдэхүүний ID", value: details.product.id },
                  ...productSpecificationRows(details.product),
                  ...(details.product.compareAtPrice
                    ? [
                        {
                          label: "Өмнөх үнэ",
                          value: formatPrice(details.product.compareAtPrice),
                        },
                      ]
                    : []),
                  ...(details.product.promotionLabel
                    ? [
                        {
                          label: "Урамшуулал",
                          value: details.product.promotionLabel,
                        },
                      ]
                    : []),
                  ...(details.product.promotionEndsAt
                    ? [
                        {
                          label: "Урамшуулал дуусах",
                          value: date(details.product.promotionEndsAt),
                        },
                      ]
                    : []),
                  ...(details.product.deliveryTerms
                    ? [
                        {
                          label: "Хүргэлт",
                          value: details.product.deliveryTerms,
                        },
                      ]
                    : []),
                  { label: "Үүсгэсэн", value: date(details.createdAt) },
                  { label: "Шинэчилсэн", value: date(details.updatedAt) },
                  ...(details.archivedAt
                    ? [{ label: "Архивласан", value: date(details.archivedAt) }]
                    : []),
                ].map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section
              className="product-details-card product-details-history"
              aria-labelledby="product-history-heading"
            >
              <h3 id="product-history-heading">
                GLB хувилбарууд <span>({details.versions.length})</span>
              </h3>
              <p>Upload хийсэн огноо, цаг · Улаанбаатар (UTC+8)</p>
              {details.processingError && (
                <p role="alert">
                  Боловсруулалтын алдаа: {details.processingError}
                </p>
              )}
              {!details.versions.length ? (
                <p className="product-history-empty">
                  <Box size={24} /> GLB хувилбар бүртгэгдээгүй байна.
                </p>
              ) : (
                <>
                  <div className="product-history-layout">
                    <div
                      className="product-history-list"
                      aria-label="GLB хувилбар сонгох"
                    >
                      {details.versions.map((version) => (
                        <button
                          type="button"
                          key={version.id}
                          className="product-history-version"
                          aria-pressed={selectedId === version.id}
                          disabled={!version.assetId}
                          onClick={() => setSelectedId(version.id)}
                        >
                          <strong>{date(version.createdAt)}</strong>
                          <span>{version.name}</span>
                          <small>
                            {status[version.status]}
                            {version.byteSize
                              ? ` · ${(version.byteSize / 1048576).toFixed(2)} MB`
                              : ""}
                          </small>
                          <small>Хувилбар {version.id.slice(0, 8)}</small>
                        </button>
                      ))}
                    </div>
                    <div className="product-history-preview">
                      {selected?.assetId ? (
                        <>
                          <h4>
                            {date(selected.createdAt)} ·{" "}
                            {status[selected.status]}
                          </h4>
                          <Preview
                            key={`${owner}:${selected.assetId}`}
                            owner={owner}
                            url={`${endpoint}?assetId=${encodeURIComponent(selected.assetId)}`}
                          />
                          <p>
                            Чирж эргүүлнэ · Scroll эсвэл хоёр хуруугаар
                            томруулна
                          </p>
                          {selected.previewKind === "source" && (
                            <p>
                              Эх GLB · Баталгаажуулалт дуусаагүй. 24 цагаас
                              хуучин дутуу upload автоматаар цэвэрлэгдэнэ.
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="product-history-empty">
                          Харах боломжтой GLB файл байхгүй байна.
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        </>
      )}
    </section>
  );
}
