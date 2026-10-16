import { StoresPageClient } from "@/components/pages/StoresPageClient";

export const metadata = { title: "Дэлгүүрүүд — tavilga.mn" };

export default async function StoresPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  return <StoresPageClient type={type} />;
}
