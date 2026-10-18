"use client";

import { useEffect, useState } from "react";
import {
  defaultMerchantLayout,
  merchantLayoutKey,
  parseMerchantLayout,
  type MerchantDashboardLayout,
} from "./dashboardLayout";

type LayoutState = {
  key: string;
  layout: MerchantDashboardLayout;
  status: "ready" | "saved" | "error";
};

export function useMerchantDashboardLayout(owner: string, storeId: string) {
  const key = merchantLayoutKey(owner, storeId);
  const [state, setState] = useState<LayoutState | null>(null);
  useEffect(() => {
    function read() {
      try {
        setState({
          key,
          layout: parseMerchantLayout(window.localStorage.getItem(key)),
          status: "ready",
        });
      } catch {
        setState({ key, layout: defaultMerchantLayout(), status: "error" });
      }
    }
    function sync(event: StorageEvent) {
      if (
        (event.key === key || event.key === null) &&
        event.storageArea === window.localStorage
      )
        read();
    }
    read();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [key]);
  const current = state?.key === key ? state : null;
  const layout = current?.layout ?? defaultMerchantLayout();
  function save(next: MerchantDashboardLayout) {
    if (!current) return;
    let status: LayoutState["status"] = "saved";
    try {
      const raw = JSON.stringify(next);
      window.localStorage.setItem(key, raw);
      if (window.localStorage.getItem(key) !== raw)
        throw new Error("Layout storage did not retain the value");
    } catch {
      status = "error";
    }
    setState((previous) =>
      previous?.key === key ? { key, layout: next, status } : previous,
    );
  }
  return {
    layout,
    ready: !!current,
    status: current?.status,
    save,
    reset: () => save(defaultMerchantLayout()),
  };
}
