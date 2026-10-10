"use client";

import { useAuth } from "@/store/auth";
import { authFetch } from "@/lib/authFetch";
import type { Product } from "@/lib/types";

export type MerchantProduct = Product & {
  modelRequested?: boolean;
  archivedAt?: string | null;
};

export const blankProduct = (): MerchantProduct => ({
  id: "new",
  name: "",
  category: "sofa",
  description: "",
  image: "",
  images: [],
  basePrice: 0,
  rating: 0,
  reviewCount: 0,
  defaultColor: "natural",

  colors: [
    {
      id: "natural",
      name: "Байгалийн өнгө",
      hex: "#C9A37A",
      priceDelta: 0,
    },
  ],

  materials: [
    {
      id: "wood",
      name: "Мод",
      priceDelta: 0,
    },
  ],

  dimensions: {
    w: 1,
    d: 1,
    h: 1,
  },

  stockQuantity: 0,
  inStock: false,

  modelRequested: false,
});

export const isOwner = (owner: string) =>
  useAuth.getState().user?.id === owner &&
  useAuth.getState().role === "merchant";

export async function merchantRequest<T>(
  path: string,
  owner: string,
  init?: RequestInit,
): Promise<T> {
  const response = await authFetch(path, init, owner);
  const result = await response.json().catch(() => null);
  if (!response.ok || !result)
    throw new Error(
      result?.error ?? "Мэдээллийг ачаалж чадсангүй. Дахин оролдоно уу.",
    );
  if (!isOwner(owner))
    throw new Error("Нэвтрэлт өөрчлөгдсөн байна. Дахин нэвтэрнэ үү.");
  return result as T;
}
