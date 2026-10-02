import { CatalogView } from "@/components/CatalogView";
import { CATEGORIES } from "@/lib/products";

export const metadata = { title: "Каталог — tavilga.mn" };

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; focus?: string; sort?: string; room?: string; offers?: string; category?: string }>;
}) {
  const filters = await searchParams;
  return (
    <CatalogView
      initialCategory={CATEGORIES.find(category => category.id === filters.category)?.id}
      initialQuery={filters.q ?? (filters.focus ? "" : undefined)}
      initialSort={filters.sort}
      initialRoom={filters.room}
      initialOffers={filters.offers === "1"}
    />
  );
}
