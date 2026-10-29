import { KitchensContent } from "@/components/pages/KitchensPageClient";
import { readCachedKitchenDesigns } from "@/lib/publicKitchens";
import { withTimeout } from "@/lib/withTimeout";

export const metadata = {
  title: "Гал тогооны загварууд — tavilga.mn",
  description: "Монголын үйлдвэр, гар урчуудын гал тогооны бэлэн загварууд.",
};

export default async function KitchenMarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [params, designs] = await Promise.all([
    searchParams,
    withTimeout(readCachedKitchenDesigns(), 8000, "Kitchen designs"),
  ]);
  const query = params.q?.trim().slice(0, 120) ?? "";
  return <KitchensContent allDesigns={designs} query={query} />;
}
