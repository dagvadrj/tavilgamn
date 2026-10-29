import { StoresContent } from "@/components/pages/StoresPageClient";
import {
  readCachedStoreDirectory,
  readCachedStoreProductCounts,
} from "@/lib/publicCatalog";
import { withTimeout } from "@/lib/withTimeout";

export const metadata = { title: "Дэлгүүрүүд — tavilga.mn" };

export default async function StoresPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const [{ type }, [directory, counts]] = await Promise.all([
    searchParams,
    withTimeout(
      Promise.all([readCachedStoreDirectory(), readCachedStoreProductCounts()]),
      8000,
      "Store directory",
    ),
  ]);
  return (
    <StoresContent
      directory={directory}
      productCounts={Object.fromEntries(counts)}
      type={type}
    />
  );
}
