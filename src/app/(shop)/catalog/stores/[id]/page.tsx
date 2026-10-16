import { StorePageClient } from "@/components/pages/StorePageClient";

export const metadata = { title: "Дэлгүүр — tavilga.mn" };

export default async function StorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StorePageClient id={id} />;
}
