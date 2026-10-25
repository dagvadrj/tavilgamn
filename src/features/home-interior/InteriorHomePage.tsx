"use client";

import { useEffect, useState } from "react";
import type { PageData } from "@/lib/pageData";
import { MotionHomepage } from "@/features/home-motion/MotionHomepage";

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
        if (!controller.signal.aborted) {
          setData(result);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(true);
          setLoading(false);
        }
      });
    return () => controller.abort();
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
