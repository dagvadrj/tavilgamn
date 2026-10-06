"use client";

import { useEffect } from "react";
import { create } from "zustand";
import type { Product } from "@/lib/types";
import { replaceDbModels } from "@/lib/modelRegistry";
import { parseProduct } from "@/lib/catalogValidation";

type State = {
  products: Product[];
  loading: boolean;
  ready: boolean;
  error: string | null;
  refresh: (force?: boolean) => Promise<void>;
};

let pending: Promise<void> | null = null;
let lastLoadedAt = 0;
const CATALOG_FRESH_MS = 30_000;

export const useCatalogStore = create<State>((set) => ({
  products: [],
  loading: false,
  ready: false,
  error: null,

  refresh: (force = false): Promise<void> => {
    if (force && pending) {
      return pending.then(() =>
        useCatalogStore.getState().refresh(),
      );
    }

    if (pending) return pending;

    set({ loading: true, error: null });

    pending = (async () => {
      try {
        const response = await fetch("/api/products", {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Тавилга ачаалсангүй.");
        }

        if (!Array.isArray(data.products)) {
          throw new Error("Тавилгын мэдээлэл буруу байна.");
        }

        const products: Product[] = data.products.map(
          (product: Product) => ({
            ...parseProduct(product),
            ...(product.model ? { model: product.model } : {}),
          }),
        );

        replaceDbModels(
          products
            .filter((product) => product.model)
            .map((product) => ({
              id: product.id,
              fileModelId: product.model!.id,
              name: product.name,
              category: product.category,
              description: product.description,
              basePrice: product.basePrice,
              glbFile: product.model!.file,
              previewGlbFile: product.model!.previewFile,
              physicalSize: product.model!.physicalSize,
              thumbnailFile: product.image.startsWith(
                `/api/models/files/${product.model!.id}/`,
              )
                ? product.image.split("/").pop() ?? ""
                : "",
              scale: product.model!.scale,
              dimensionsW: product.dimensions.w,
              dimensionsD: product.dimensions.d,
              dimensionsH: product.dimensions.h,
              colors: product.colors,
              materials: product.materials,
              inStock: product.inStock,
              stockQuantity: product.stockQuantity,
            })),
        );

        lastLoadedAt = Date.now();
        set({ products, ready: true });
      } catch (error) {
        const ready = useCatalogStore.getState().ready;
        if (!ready) replaceDbModels([]);

        set({
          ...(ready ? {} : { products: [], ready: false }),
          error:
            error instanceof Error
              ? error.message
              : "Алдаа гарлаа.",
        });
      } finally {
        set({ loading: false });
      }
    })().finally(() => {
      pending = null;
    });

    return pending;
  },
}));

export function useCatalog() {
  const state = useCatalogStore();

  useEffect(() => {
    const refresh = () => {
      const catalog = useCatalogStore.getState();
      if (document.visibilityState === "visible" && (!catalog.ready || Date.now() - lastLoadedAt >= CATALOG_FRESH_MS)) void catalog.refresh();
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  return state;
}

export const getProduct = (id: string) =>
  useCatalogStore
    .getState()
    .products.find((product) => product.id === id);
