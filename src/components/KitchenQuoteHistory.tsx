"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  MessageSquareQuote,
  RefreshCw,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { formatPrice } from "@/lib/format";
import type { KitchenQuoteStatus } from "@/lib/kitchenQuotes";
import { useAuth } from "@/store/auth";
import { useKitchenQuoteFocus } from "@/features/kitchen-planner/hooks/useKitchenQuoteFocus";

type CustomerKitchenQuote = {
  id: string;
  designSlug: string;
  projectName: string;
  storeName: string;
  status: KitchenQuoteStatus;
  quotedPrice: number | null;
  merchantNote: string;
  createdAt: string;
  updatedAt: string;
};

const STATUS_LABEL: Record<KitchenQuoteStatus, string> = {
  submitted: "Илгээсэн",
  reviewing: "Үйлдвэр шалгаж байна",
  quoted: "Үнийн санал бэлэн",
  closed: "Хаасан",
};

export function KitchenQuoteHistory() {
  const { quoteId, clear } = useKitchenQuoteFocus();
  const user = useAuth((state) => state.user);
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{
    quotes: CustomerKitchenQuote[];
    hasMore: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const response = await authFetch(
          `/api/kitchen-quotes?page=${page}${quoteId ? `&quote=${quoteId}` : ""}`,
          { signal: controller.signal },
          user.id,
        );
        const data = await response.json().catch(() => null);
        if (!response.ok || !data)
          throw new Error(
            data?.error ?? "Үнийн хүсэлтүүдийг ачаалж чадсангүй.",
          );
        if (active && useAuth.getState().user?.id === user.id) setResult(data);
      } catch (reason) {
        if (active && !controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Үнийн хүсэлтүүдийг ачаалж чадсангүй.",
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [user, page, refresh, quoteId]);

  if (loading)
    return (
      <div
        className="account-card p-8 text-sm text-[#68686f]"
        role="status"
      >
        Үнийн хүсэлтүүдийг ачаалж байна…
      </div>
    );
  if (error)
    return (
      <div className="rounded-lg border border-red-200 p-5">
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
        <button
          type="button"
          className="account-button mt-3"
          onClick={() => setRefresh((value) => value + 1)}
        >
          <RefreshCw size={15} />
          Дахин оролдох
        </button>
      </div>
    );
  if (!result?.quotes.length)
    return (
      <div className="account-empty">
        <MessageSquareQuote aria-hidden="true" />
        <p>
          Та одоогоор гал тогооны үнийн хүсэлт илгээгээгүй байна.
        </p>
        <Link
          href="/kitchens"
          className="account-button"
        >
          Marketplace загвар үзэх
        </Link>
      </div>
    );

  return (
    <div className="space-y-4">
      {quoteId && (
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            clear();
            setPage(0);
          }}
        >
          Бүх үнийн хүсэлт харах
        </button>
      )}
      {result.quotes.map((quote) => (
        <article
          id={`quote-${quote.id}`}
          key={quote.id}
          className="account-card p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Link
                href={`/kitchens/${quote.designSlug}`}
                className="font-semibold text-[#171717] hover:underline"
              >
                {quote.projectName}
              </Link>
              <p className="mt-2 text-xs text-[#68686f]">
                {quote.storeName} ·{" "}
                {new Date(quote.createdAt).toLocaleDateString("mn-MN")}
              </p>
            </div>
            <span className="account-quote-status" data-status={quote.status}>
              {STATUS_LABEL[quote.status]}
            </span>
          </div>
          {quote.quotedPrice != null ? (
            <p className="mt-4 border-t border-[#e4e4e7] pt-4 text-sm text-[#68686f]">
              Үнийн санал:{" "}
              <strong className="text-lg text-[#171717]">
                {formatPrice(quote.quotedPrice)}
              </strong>
            </p>
          ) : null}
          {quote.merchantNote ? (
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[#52525b]">
              {quote.merchantNote}
            </p>
          ) : null}
        </article>
      ))}
      <nav
        className="flex flex-wrap items-center justify-end gap-2"
        aria-label="Үнийн хүсэлтийн хуудаслалт"
      >
        <span className="mr-auto text-xs text-[#68686f]" aria-live="polite">Хуудас {page + 1}</span>
        <button
          type="button"
          className="account-button disabled:opacity-40"
          disabled={page === 0}
          onClick={() => setPage((value) => value - 1)}
        >
          <ChevronLeft size={15} />
          Өмнөх
        </button>
        <button
          type="button"
          className="account-button disabled:opacity-40"
          disabled={!result.hasMore}
          onClick={() => setPage((value) => value + 1)}
        >
          Дараах
          <ChevronRight size={15} />
        </button>
      </nav>
    </div>
  );
}
