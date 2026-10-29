import { StorePage as StoreDetail } from "@/components/pages/StorePage";

export const metadata = { title: "Дэлгүүр — tavilga.mn" };

export default async function StorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StoreDetail id={id} />;
}
