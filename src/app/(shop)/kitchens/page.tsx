import { KitchensPageClient } from "@/components/pages/KitchensPageClient";

export const metadata = {
  title: "Гал тогооны загварууд — tavilga.mn",
  description: "Монголын үйлдвэр, гар урчуудын гал тогооны бэлэн загварууд.",
};

export default async function KitchenMarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const query = (await searchParams).q?.trim().slice(0, 120) ?? "";
  return <KitchensPageClient query={query} />;
}
