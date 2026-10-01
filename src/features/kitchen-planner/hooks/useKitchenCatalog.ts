"use client";
import { useEffect, useState } from "react";
import type { KitchenCatalogModule } from "@/lib/kitchenModuleCatalog";
import { normalizeKitchenMaterials, type KitchenMaterialDefinition } from "@/lib/kitchenMaterials";

export function useKitchenCatalog(active: boolean) {
  const [moduleCatalog, setModuleCatalog] = useState<KitchenCatalogModule[]>(
    [],
  );
  const [materialCatalog, setMaterialCatalog] = useState<
    KitchenMaterialDefinition[]
  >([]);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
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
          setModuleCatalog([]);
          setMaterialCatalog([]);
        }
      });
    return () => controller.abort();
  }, [active]);
  return { moduleCatalog, materialCatalog };
}
