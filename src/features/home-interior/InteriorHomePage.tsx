"use client";

import { useEffect, useState } from "react";
import type { PageData } from "@/lib/pageData";
import { InteriorHome } from "./InteriorHome";

const EMPTY_HOME: PageData["home"] = {
  catalog: [],
  stores: [],
  paymentLabels: [],
};

export function InteriorHomePage() {
  const [data, setData] = useState<PageData["home"]>(EMPTY_HOME);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/page-data/home", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Home data unavailable");
        const result = await response.json();
        if (!Array.isArray(result.catalog) || !Array.isArray(result.stores))
          throw new Error("Invalid home data");
        if (!controller.signal.aborted) setData(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, []);
  return <InteriorHome {...data} dataError={error} />;
}
