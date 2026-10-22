"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/authFetch";
import type { OrderQuote } from "@/lib/orders";

type QuoteResult = { key: string; value: OrderQuote | null; error: string | null };

/** A quote belongs to exactly one account/cart. Cleanup discards stale responses. */
export function useCheckoutQuote(userId: string | undefined, signature: string) {
  const key = JSON.stringify([userId, signature]);
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [retry, setRetry] = useState(0);
  const enabled = !!userId && signature !== "[]";
  useEffect(() => {
    if (!enabled || !userId) { setResult(null); return; }
    const controller = new AbortController();
    let active = true;
    setResult(null);
    void authFetch("/api/orders/quote", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: JSON.parse(signature) }), signal: controller.signal,
    }, userId).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Үнийг шалгаж чадсангүй.");
      if (active) setResult({ key, value: data, error: null });
    }).catch(error => {
      if (active) setResult({ key, value: null, error: error instanceof Error ? error.message : "Үнийг шалгаж чадсангүй." });
    });
    return () => { active = false; controller.abort(); };
  }, [enabled, userId, signature, key, retry]);
  const current = enabled && result?.key === key ? result : null;
  const acceptPriceChange = useCallback((value: OrderQuote) => {
    setResult(previous => previous?.key === key ? { key, value, error: null } : previous);
  }, [key]);
  const retryQuote = useCallback(() => {
    setResult(previous => previous?.key === key ? null : previous);
    setRetry(value => value + 1);
  }, [key]);
  return { quote: current?.value ?? null, error: current?.error ?? null, loading: enabled && !current, retryQuote, acceptPriceChange };
}
