import { notFound } from "next/navigation";
import { AdminDashboard } from "@/components/AdminDashboard";

export const metadata = { title: "Загварын хяналт · tavilga.mn" };

export default async function AdminKitchenDetailPage({
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
  return <AdminDashboard kitchenDesignId={id} />;
}
