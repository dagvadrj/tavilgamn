"use client";

import { useAuth } from "@/store/auth";
import { authFetch } from "@/lib/authFetch";
import type { Product } from "@/lib/types";
import { merchantQueryFor } from "./merchantQueries";

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
  if (!isOwner(owner))
    throw new Error("Нэвтрэлт өөрчлөгдсөн байна. Дахин нэвтэрнэ үү.");
  const query =
    !init?.method || init.method.toUpperCase() === "GET"
      ? merchantQueryFor(path)
      : null;
  let variables: Record<string, unknown> | undefined = query?.variables;
  const products: MerchantProduct[] = [],
    cursors = new Set<string>();
  for (;;) {
    const response = await authFetch(
      query ? "/api/merchant/graphql" : path,
      query
        ? {
            ...init,
            method: "POST",
            headers: {
              ...init?.headers,
              "Content-Type": "application/json",
              Accept: "application/graphql-response+json, application/json",
            },
            body: JSON.stringify({
              query: query.query,
              operationName: query.operationName,
              variables,
            }),
          }
        : init,
      owner,
    );
    const result = await response.json().catch(() => null);
    if (!response.ok || !result)
      throw new Error(
        result?.error ??
          result?.errors?.[0]?.message ??
          "Мэдээллийг ачаалж чадсангүй. Дахин оролдоно уу.",
      );
    if (!isOwner(owner))
      throw new Error("Нэвтрэлт өөрчлөгдсөн байна. Дахин нэвтэрнэ үү.");
    if (query) {
      if (
        result.errors?.length ||
        !result.data ||
        !(query.field in result.data)
      )
        throw new Error(
          result.errors?.[0]?.message ?? "GraphQL мэдээллийг ачаалж чадсангүй.",
        );
      if (query.paginate) {
        const page = result.data[query.field];
        if (!Array.isArray(page?.products))
          throw new Error("Барааны мэдээлэл буруу байна.");
        products.push(...page.products);
        if (page.nextCursor != null) {
          if (
            typeof page.nextCursor !== "string" ||
            cursors.has(page.nextCursor)
          )
            throw new Error("Барааны хуудас давтагдсан байна.");
          cursors.add(page.nextCursor);
          variables = { ...variables, after: page.nextCursor };
          continue;
        }
        return { products } as T;
      }
      return (query.wrap ? result.data : result.data[query.field]) as T;
    }
    return result as T;
  }
}
