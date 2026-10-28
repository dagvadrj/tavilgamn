"use client";
import { useEffect, useState } from "react";

let cached: Promise<Map<string, string>> | null = null;

function loadStoreNames() {
  cached ??= fetch("/api/stores")
    .then((response) => (response.ok ? response.json() : { stores: [] }))
    .then(
      (data: { stores?: { id: string; name: string }[] }) =>
        new Map((data.stores ?? []).map((store) => [store.id, store.name])),
    )
    .catch(() => {
      // A failed directory only hides merchant names; the catalog still works.
      cached = null;
      return new Map<string, string>();
    });
  return cached;
}

/** Merchant display names for catalog cards and the store filter. */
export function useStoreNames() {
  const [names, setNames] = useState<Map<string, string>>(() => new Map());
  useEffect(() => {
    let active = true;
    void loadStoreNames().then((loaded) => {
      if (active) setNames(loaded);
    });
    return () => {
      active = false;
    };
  }, []);
  return names;
}
