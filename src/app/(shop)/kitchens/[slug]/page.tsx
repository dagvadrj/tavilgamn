import { KitchenPageClient } from "@/components/pages/KitchenPageClient";

export const metadata = { title: "Гал тогооны загвар — tavilga.mn" };

export default async function KitchenDesignPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <KitchenPageClient slug={slug} />;
}
