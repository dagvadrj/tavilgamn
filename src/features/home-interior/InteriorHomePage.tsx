"use client";

import { useEffect, useState } from "react";
import type { PageData } from "@/lib/pageData";
import { MotionHomepage } from "@/features/home-motion/MotionHomepage";
import { PAGE_DATA_TIMEOUT_MS } from "@/lib/pageDataTimeout";

const EMPTY_HOME: PageData["home"] = {
  catalog: [],
  stores: [],
  paymentLabels: [],
};

export function InteriorHomePage() {
  const [data, setData] = useState<PageData["home"]>(EMPTY_HOME);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    // Past this the hero offers its retry instead of loading indefinitely.
    const timer = setTimeout(() => controller.abort(), PAGE_DATA_TIMEOUT_MS);
    let disposed = false;
    setError(false);
    setLoading(true);
    void fetch("/api/page-data/home", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Home data unavailable");
        const result = await response.json();
        if (!Array.isArray(result.catalog) || !Array.isArray(result.stores))
          throw new Error("Invalid home data");
        if (!disposed) {
          setData(result);
          setLoading(false);
        }
      })
      .catch(() => {
        // A timeout aborts too; only an unmount should stay silent.
        if (!disposed) {
          setError(true);
          setLoading(false);
        }
      })
      .finally(() => clearTimeout(timer));
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [attempt]);
  return (
    <MotionHomepage
      {...data}
      loading={loading}
      error={error}
      onRetry={() => setAttempt((value) => value + 1)}
    />
  );
}
