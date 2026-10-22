import type { Product, Store } from "./types";

export type HomepageHero = {
  title: string;
  description: string;
  image: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
};

export const DEFAULT_HOMEPAGE_HERO: HomepageHero = {
  title: "Тавилгаа сонго. Орон зайдаа тааруул.",
  description:
    "Тавилгын сонголт, 3D төлөвлөлт, үйлдвэрийн үнийн санал. Гэрээ тохижуулах дараагийн алхмаа нэг дороос.",
  image: "",
  primaryLabel: "Тавилга үзэх",
  primaryHref: "/catalog",
  secondaryLabel: "Гал тогоо төлөвлөх",
  secondaryHref: "/kitchen",
};

export function isHomepageDestination(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length > 240 ||
    !value.startsWith("/") ||
    /[\\\s\u0000-\u001f]/.test(value)
  )
    return false;
  try {
    const url = new URL(value, "https://tavilga.mn");
    return (
      url.origin === "https://tavilga.mn" &&
      /^\/(?:catalog(?:\/[^/]+)*|planner|kitchen|kitchens(?:\/[^/]+)?|stores|merchant)?$/.test(
        url.pathname,
      )
    );
  } catch {
    return false;
  }
}

export function parseHomepageHero(value: unknown): HomepageHero | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const hero = value as Record<string, unknown>;
  const text = (key: string, max: number) =>
    typeof hero[key] === "string" &&
    !!(hero[key] as string).trim() &&
    (hero[key] as string).length <= max;
  if (
    !text("title", 120) ||
    !text("description", 320) ||
    !text("primaryLabel", 45) ||
    !text("secondaryLabel", 45) ||
    !isHomepageDestination(hero.primaryHref) ||
    !isHomepageDestination(hero.secondaryHref)
  )
    return null;
  if (
    typeof hero.image !== "string" ||
    hero.image.length > 1000 ||
    /[\\\s\u0000-\u001f]/.test(hero.image)
  )
    return null;
  if (
    hero.image &&
    !(hero.image.startsWith("/") && !hero.image.startsWith("//"))
  ) {
    try {
      const url = new URL(hero.image);
      if (url.protocol !== "https:" || url.username || url.password)
        return null;
    } catch {
      return null;
    }
  }
  return Object.fromEntries(
    Object.keys(DEFAULT_HOMEPAGE_HERO).map((key) => [
      key,
      (hero[key] as string).trim(),
    ]),
  ) as HomepageHero;
}

export type HomepageStatistics = {
  stores: number;
  products: number;
  models: number;
  materials: number | null;
  rating: number | null;
  reviews: number;
  categories: { id: string; count: number }[];
};

/** The inputs are the complete public catalog and active directory, never a page slice. */
export function homepageStatistics(
  catalog: Product[],
  stores: Store[],
  materials: number | null,
): HomepageStatistics {
  const unique = [
    ...new Map(catalog.map((product) => [product.id, product])).values(),
  ];
  const categories = new Map<string, number>();
  let reviews = 0,
    weighted = 0;
  for (const product of unique) {
    categories.set(
      product.category,
      (categories.get(product.category) ?? 0) + 1,
    );
    if (
      Number.isFinite(product.rating) &&
      product.rating > 0 &&
      product.rating <= 5 &&
      Number.isSafeInteger(product.reviewCount) &&
      product.reviewCount > 0
    ) {
      reviews += product.reviewCount;
      weighted += product.rating * product.reviewCount;
    }
  }
  return {
    stores: new Set(stores.map((store) => store.id)).size,
    products: unique.length,
    models: unique.filter((product) => product.model).length,
    materials,
    rating: reviews ? weighted / reviews : null,
    reviews,
    categories: [...categories]
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id)),
  };
}
