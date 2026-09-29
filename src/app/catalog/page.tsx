import { CatalogView } from "@/components/CatalogView";

export const metadata = { title: "Каталог — tavilga.mn" };

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; focus?: string; sort?: string; room?: string }>;
}) {
  const filters = await searchParams;
  return (
    <CatalogView
      initialQuery={filters.q ?? (filters.focus ? "" : undefined)}
      initialSort={filters.sort}
      initialRoom={filters.room}
    />
  );
}
