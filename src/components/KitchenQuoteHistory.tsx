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
          `/api/kitchen-quotes?page=${page}`,
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
  }, [user, page, refresh]);

  if (loading)
    return (
      <div
        className="rounded-lg border border-[#293C32]/10 p-8 text-sm text-[#737D6C]"
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
          className="mt-3 inline-flex items-center gap-2 text-sm"
          onClick={() => setRefresh((value) => value + 1)}
        >
          <RefreshCw size={15} />
          Дахин оролдох
        </button>
      </div>
    );
  if (!result?.quotes.length)
    return (
      <div className="rounded-lg border border-dashed border-[#293C32]/20 p-10 text-center">
        <MessageSquareQuote className="mx-auto text-[#293C32]/35" />
        <p className="mt-3 text-sm text-[#737D6C]">
          Та одоогоор гал тогооны үнийн хүсэлт илгээгээгүй байна.
        </p>
        <Link
          href="/kitchens"
          className="mt-4 inline-flex text-sm font-medium text-[#42634f]"
        >
          Marketplace загвар үзэх
        </Link>
      </div>
    );

  return (
    <div className="space-y-4">
      {result.quotes.map((quote) => (
        <article
          key={quote.id}
          className="rounded-xl border border-[#293C32]/10 bg-white p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Link
                href={`/kitchens/${quote.designSlug}`}
                className="font-medium text-[#293C32] hover:underline"
              >
                {quote.projectName}
              </Link>
              <p className="mt-1 text-xs text-[#737D6C]">
                {quote.storeName} ·{" "}
                {new Date(quote.createdAt).toLocaleDateString("mn-MN")}
              </p>
            </div>
            <span className="rounded-full bg-[#293C32]/[.07] px-3 py-1 text-xs text-[#293C32]">
              {STATUS_LABEL[quote.status]}
            </span>
          </div>
          {quote.quotedPrice != null ? (
            <p className="mt-4 text-sm">
              Үнийн санал:{" "}
              <strong className="text-lg text-[#293C32]">
                {formatPrice(quote.quotedPrice)}
              </strong>
            </p>
          ) : null}
          {quote.merchantNote ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#6C726B]">
              {quote.merchantNote}
            </p>
          ) : null}
        </article>
      ))}
      <nav
        className="flex items-center justify-end gap-2"
        aria-label="Үнийн хүсэлтийн хуудаслалт"
      >
        <span className="mr-auto text-xs text-[#737D6C]">
          Хуудас {page + 1}
        </span>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border px-3 py-2 text-sm disabled:opacity-40"
          disabled={page === 0}
          onClick={() => setPage((value) => value - 1)}
        >
          <ChevronLeft size={15} />
          Өмнөх
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border px-3 py-2 text-sm disabled:opacity-40"
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
