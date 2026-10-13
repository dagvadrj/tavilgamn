import { notFound } from "next/navigation";
import { MerchantDashboard } from "@/components/MerchantDashboard";
import "../../merchant.css";

export const metadata = {
  title: "Гал тогооны загварын дэлгэрэнгүй · tavilga.mn",
};

export default async function MerchantKitchenDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  )
    notFound();
  return <MerchantDashboard kitchenDesignId={id} />;
}
