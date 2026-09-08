import { notFound } from "next/navigation";
import { CatalogView } from "@/components/CatalogView";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/products";
import type { Category } from "@/lib/types";

const VALID = new Set(CATEGORIES.map((c) => c.id));

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.id }));
}

export function generateMetadata({ params }: { params: { category: string } }) {
  if (!VALID.has(params.category as Category)) return {};
  return {
    title: `${CATEGORY_LABEL[params.category as Category]} — tavilga.mn`,
  };
}

export default function CategoryPage({
  params,
}: {
  params: { category: string };
}) {
  if (!VALID.has(params.category as Category)) notFound();
  const category = params.category as Category;
  return <CatalogView initialCategory={category} />;
}
