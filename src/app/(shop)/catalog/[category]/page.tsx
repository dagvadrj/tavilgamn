import { notFound } from "next/navigation";
import { CatalogView } from "@/components/CatalogView";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/products";
import type { Category } from "@/lib/types";

const VALID = new Set(CATEGORIES.map((c) => c.id));

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!VALID.has(category as Category)) return {};
  return {
    title: `${CATEGORY_LABEL[category as Category]} — tavilga.mn`,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: categoryParam } = await params;
  if (!VALID.has(categoryParam as Category)) notFound();
  const category = categoryParam as Category;
  return <CatalogView initialCategory={category} />;
}
