import { CatalogView } from "@/components/CatalogView";

export const metadata = { title: "Каталог — tavilga.mn" };

export default function CatalogPage({
  searchParams,
}: {
  searchParams: { q?: string; focus?: string; sort?: string; room?: string };
}) {
  return (
    <CatalogView
      initialQuery={searchParams.q ?? (searchParams.focus ? "" : undefined)}
      initialSort={searchParams.sort}
      initialRoom={searchParams.room}
    />
  );
}
