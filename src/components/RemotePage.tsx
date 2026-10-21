"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { PageSkeleton, type SkeletonVariant } from "./PageSkeleton";
import { afterPagePaint } from "@/lib/afterPagePaint";
import type { PageData } from "@/lib/pageData";

export function RemotePage<K extends keyof PageData>({
  page,
  id,
  variant,
  children,
}: {
  page: K;
  id?: string;
  variant: SkeletonVariant;
  children: (data: PageData[K]) => ReactNode;
}) {
  const url = `/api/page-data/${page}${id ? `?id=${encodeURIComponent(id)}` : ""}`;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    url: string;
    attempt: number;
    data?: PageData[K];
    error?: string;
    missing?: boolean;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const cancelPaint = afterPagePaint(() => {
      void (async () => {
        try {
          const response = await fetch(url, {
            method: "GET",
            signal: controller.signal,
            cache: "no-store",
          });
          const data = await response.json();
          if (controller.signal.aborted) return;
          if (!response.ok) {
            setResult({
              url,
              attempt,
              error: data.error ?? "Мэдээллийг ачаалж чадсангүй.",
              missing: response.status === 404,
            });
            return;
          }
          setResult({ url, attempt, data });
        } catch {
          if (!controller.signal.aborted)
            setResult({
              url,
              attempt,
              error: "Сүлжээний алдаа гарлаа. Дахин оролдоно уу.",
            });
        }
      })();
    });
    return () => {
      cancelPaint();
      controller.abort();
    };
  }, [url, attempt]);

  const current =
    result?.url === url && result.attempt === attempt ? result : null;
  if (!current) return <PageSkeleton variant={variant} layout={page === "product" ? "detail" : page === "kitchen" ? "kitchen-detail" : page} />;
  if (current.error)
    return (
      <div className="shop-container py-16 text-center">
        <h1 className="text-xl font-semibold">
          {current.missing
            ? "Мэдээлэл олдсонгүй"
            : "Мэдээллийг ачаалж чадсангүй"}
        </h1>
        <p role="alert" className="my-4 text-sm">
          {current.error}
        </p>
        {current.missing ? (
          <Link href="/catalog" className="btn-primary">
            Каталог үзэх
          </Link>
        ) : (
          <button
            type="button"
            className="btn-primary"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Дахин оролдох
          </button>
        )}
      </div>
    );
  return <div className="page-data-ready">{children(current.data!)}</div>;
}
