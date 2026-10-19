import { notFound } from "next/navigation";
import { StorePageClient } from "@/components/pages/StorePageClient";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { jsonObject } from "@/lib/supabase/json";
export const dynamic = "force-dynamic";
export const metadata = { title: "Дэлгүүрийн 3D каталог — tavilga.mn" };
export default async function PublicStore({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!slug || slug.length > 200) notFound();
  const { data, error } = await getSupabaseAdmin().rpc(
    "resolve_merchant_store_link",
    { p_key: slug },
  );
  if (error) throw error;
  if (!data) notFound();
  const store = jsonObject(data);
  if (typeof store.storeId !== "string") notFound();
  return (
    <StorePageClient id={store.storeId} verified={store.verified === true} />
  );
}
