"use client";
import { useEffect, useState } from "react";
import type { KitchenCatalogModule } from "@/lib/kitchenModuleCatalog";
import { normalizeKitchenMaterials, type KitchenMaterialDefinition } from "@/lib/kitchenMaterials";

export function useKitchenCatalog(active: boolean) {
  const [loading, setLoading] = useState(active);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [moduleCatalog, setModuleCatalog] = useState<KitchenCatalogModule[]>(
    [],
  );
  const [materialCatalog, setMaterialCatalog] = useState<
    KitchenMaterialDefinition[]
  >([]);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    fetch("/api/kitchen-modules", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) =>
        response.ok ? response.json() : Promise.reject(new Error("catalog")),
      )
      .then((result) => {
        setModuleCatalog(Array.isArray(result.modules) ? result.modules : []);
        setMaterialCatalog(normalizeKitchenMaterials(result.materials));
      })
      .catch((error) => {
        if (error?.name !== "AbortError") {
          setError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [active, attempt]);
  return { moduleCatalog, materialCatalog, loading, error, retry: () => setAttempt(value => value + 1) };
}
