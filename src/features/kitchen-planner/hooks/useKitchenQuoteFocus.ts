"use client";
import { useEffect, useState } from "react";

export function useKitchenQuoteFocus() {
  const [quoteId, setQuoteId] = useState<string | null>(null);
  useEffect(() => {
    const read = () => {
      const id = new URLSearchParams(window.location.search).get("quote");
      setQuoteId(id && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id) ? id : null);
    };
    read(); window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  const clear = () => {
    const url = new URL(window.location.href); url.searchParams.delete("quote");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };
  return { quoteId, clear };
}
