import { ProductPageClient } from "@/components/pages/ProductPageClient";

export const metadata = { title: "Тавилгын дэлгэрэнгүй — tavilga.mn" };

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ view?: string; color?: string }>;
}) {
  const { id } = await params;
  const options = await searchParams;
  return (
    <ProductPageClient id={id} view={options?.view} color={options?.color} />
  );
}
