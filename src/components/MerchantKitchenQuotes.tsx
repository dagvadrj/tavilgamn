"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Mail,
  MessageSquareQuote,
  Phone,
  RefreshCw,
  Send,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { formatPrice } from "@/lib/format";
import type { KitchenQuoteStatus } from "@/lib/kitchenQuotes";
import { useAuth } from "@/store/auth";

type MerchantKitchenQuote = {
  id: string;
  projectName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  customerMessage: string;
  roomDetails: { widthMm?: number; depthMm?: number; heightMm?: number };
  status: KitchenQuoteStatus;
  quotedPrice: number | null;
  merchantNote: string;
  cabinetCount: number;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

const STATUS_LABEL: Record<KitchenQuoteStatus, string> = {
  submitted: "Шинэ хүсэлт",
  reviewing: "Шалгаж буй",
  quoted: "Санал илгээсэн",
  closed: "Хаасан",
};

const isOwner = (owner: string) =>
  useAuth.getState().user?.id === owner &&
  useAuth.getState().role === "merchant";

export function MerchantKitchenQuotes({ owner }: { owner: string }) {
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{
    quotes: MerchantKitchenQuote[];
    hasMore: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const response = await authFetch(
          `/api/merchant/kitchen-quotes?page=${page}`,
          { signal: controller.signal },
          owner,
        );
        const data = await response.json().catch(() => null);
        if (!response.ok || !data)
          throw new Error(
            data?.error ?? "Үнийн хүсэлтүүдийг ачаалж чадсангүй.",
          );
        if (active && isOwner(owner)) setResult(data);
      } catch (reason) {
        if (active && !controller.signal.aborted) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Үнийн хүсэлтүүдийг ачаалж чадсангүй.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [owner, page, refresh]);

  const update = (id: string, changes: Partial<MerchantKitchenQuote>) => {
    setResult(
      (current) =>
        current && {
          ...current,
          quotes: current.quotes.map((quote) =>
            quote.id === id ? { ...quote, ...changes } : quote,
          ),
        },
    );
  };

  return (
    <section>
      <div className="merchant-section-heading">
        <div>
          <h2 className="text-2xl">Гал тогооны үнийн хүсэлт</h2>
          <p className="merchant-muted">
            Хэрэглэгчийн өрөө, холбоо барих мэдээлэлд үндэслэн үнийн санал
            илгээнэ.
          </p>
        </div>
        <button
          type="button"
          className="btn-ghost"
          disabled={loading}
          onClick={() => setRefresh((value) => value + 1)}
        >
          <RefreshCw size={16} />
          Шинэчлэх
        </button>
      </div>
      {loading ? (
        <div className="merchant-state" role="status">
          Үнийн хүсэлтүүдийг ачаалж байна…
        </div>
      ) : error ? (
        <p className="merchant-error" role="alert">
          {error}
        </p>
      ) : !result?.quotes.length ? (
        <div className="merchant-panel merchant-state">
          <MessageSquareQuote size={32} />
          <h3>Одоогоор үнийн хүсэлт алга</h3>
          <p>Marketplace загвараас хүсэлт ирэхэд энд харагдана.</p>
        </div>
      ) : (
        <div className="merchant-orders">
          {result.quotes.map((quote) => (
            <MerchantKitchenQuoteCard
              key={quote.id}
              owner={owner}
              quote={quote}
              onUpdated={update}
            />
          ))}
        </div>
      )}
      <nav className="merchant-actions" aria-label="Үнийн хүсэлтийн хуудаслалт">
        <span aria-live="polite" className="merchant-muted">
          Хуудас {page + 1}
        </span>
        <button
          type="button"
          className="btn-ghost"
          disabled={page === 0 || loading}
          onClick={() => setPage((value) => value - 1)}
        >
          <ChevronLeft size={15} />
          Өмнөх
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={loading || !!error || !result?.hasMore}
          onClick={() => setPage((value) => value + 1)}
        >
          Дараах
          <ChevronRight size={15} />
        </button>
      </nav>
    </section>
  );
}

function MerchantKitchenQuoteCard({
  owner,
  quote,
  onUpdated,
}: {
  owner: string;
  quote: MerchantKitchenQuote;
  onUpdated: (id: string, changes: Partial<MerchantKitchenQuote>) => void;
}) {
  const [price, setPrice] = useState(quote.quotedPrice?.toString() ?? "");
  const [note, setNote] = useState(quote.merchantNote);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const room = quote.roomDetails;

  const changeStatus = async (status: "reviewing" | "quoted" | "closed") => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const quotedPrice =
        status === "quoted" ? Number(price) : quote.quotedPrice;
      const response = await authFetch(
        "/api/merchant/kitchen-quotes",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: quote.id,
            status,
            expectedStatus: quote.status,
            quotedPrice,
            note,
          }),
        },
        owner,
      );
      const data = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          data?.error ?? "Үнийн хүсэлтийн төлөвийг шинэчилж чадсангүй.",
        );
      if (isOwner(owner)) {
        onUpdated(quote.id, { status, quotedPrice, merchantNote: note });
        setMessage("Хэрэглэгчид шинэ төлөвийн мэдэгдэл илгээгдлээ.");
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Үнийн хүсэлтийн төлөвийг шинэчилж чадсангүй.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="merchant-panel merchant-order">
      <header className="merchant-section-heading">
        <div className="flex min-w-0 items-center gap-3">
          {quote.thumbnailUrl ? (
            <Image
              className="h-16 w-20 rounded-xl object-cover"
              src={quote.thumbnailUrl}
              alt=""
              width={80}
              height={64}
            />
          ) : null}
          <div className="min-w-0">
            <h3 className="truncate">{quote.projectName}</h3>
            <p>
              {new Date(quote.createdAt).toLocaleString("mn-MN", {
                timeZone: "Asia/Ulaanbaatar",
              })}{" "}
              · {quote.cabinetCount} модуль
            </p>
          </div>
        </div>
        <span className="merchant-order-status">
          {STATUS_LABEL[quote.status]}
        </span>
      </header>
      <div className="merchant-order-details">
        <div>
          <h4>Холбоо барих</h4>
          <p>{quote.contactName}</p>
          <p>
            <a
              className="inline-flex items-center gap-1 hover:underline"
              href={`tel:${quote.contactPhone}`}
            >
              <Phone size={13} />
              {quote.contactPhone}
            </a>
          </p>
          <p>
            <a
              className="inline-flex items-center gap-1 break-all hover:underline"
              href={`mailto:${quote.contactEmail}`}
            >
              <Mail size={13} />
              {quote.contactEmail}
            </a>
          </p>
        </div>
        <div>
          <h4>Өрөө ба хүсэлт</h4>
          {room.widthMm && room.depthMm && room.heightMm ? (
            <p>
              {room.widthMm} × {room.depthMm} × {room.heightMm} мм
            </p>
          ) : (
            <p>Өрөөний хэмжээ оруулаагүй</p>
          )}
          <p className="mt-2 whitespace-pre-wrap">
            {quote.customerMessage || "Нэмэлт тайлбаргүй"}
          </p>
        </div>
      </div>
      {quote.quotedPrice != null ? (
        <div className="merchant-order-footer">
          <span>Илгээсэн үнийн санал</span>
          <strong>{formatPrice(quote.quotedPrice)}</strong>
        </div>
      ) : null}
      {quote.status !== "closed" ? (
        <fieldset className="mt-5 space-y-3" disabled={busy}>
          {quote.status === "submitted" ? (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => void changeStatus("reviewing")}
            >
              Шалгаж эхлэх
            </button>
          ) : null}
          {quote.status === "submitted" || quote.status === "reviewing" ? (
            <div className="merchant-form-grid">
              <label>
                Үнийн санал (₮)
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={Number.MAX_SAFE_INTEGER}
                  step={1}
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                />
              </label>
              <label className="merchant-span">
                Тайлбар
                <textarea
                  className="input min-h-24"
                  maxLength={5000}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Материал, ажлын хугацаа, нөхцөл…"
                />
              </label>
              <button
                type="button"
                className="btn-primary"
                disabled={!price || !Number.isSafeInteger(Number(price))}
                onClick={() => void changeStatus("quoted")}
              >
                <Send size={16} />
                Үнийн санал илгээх
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className="btn-ghost"
            onClick={() => void changeStatus("closed")}
          >
            Хүсэлтийг хаах
          </button>
        </fieldset>
      ) : null}
      {error ? (
        <p className="merchant-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="merchant-success" role="status">
          {message}
        </p>
      ) : null}
    </article>
  );
}
