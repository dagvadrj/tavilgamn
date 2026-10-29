import { notFound } from "next/navigation";
import { KitchenContent } from "@/components/pages/KitchenPageClient";
import { readCachedKitchenDesignBySlug } from "@/lib/publicKitchens";
import { withTimeout } from "@/lib/withTimeout";

export const metadata = { title: "Гал тогооны загвар — tavilga.mn" };

export default async function KitchenDesignPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!slug || slug.length > 100) notFound();
  const design = await withTimeout(
    readCachedKitchenDesignBySlug(slug),
    8000,
    "Kitchen design",
  );
  if (!design) notFound();
  return <KitchenContent design={design} />;
}
