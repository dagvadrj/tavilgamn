import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, MapPin, Phone } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { getStore } from "@/lib/stores";
import { CATEGORY_LABEL } from "@/lib/products";
import { readProducts } from "@/lib/catalogServer";
import { hasAvailableStock } from "@/lib/inventory";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { id: string } }) {
  const store = getStore(params.id);
  if (!store) return {};
  return { title: `${store.name} — tavilga.mn` };
}

export default async function StorePage({
  params,
}: {
  params: { id: string };
}) {
  const store = getStore(params.id);

  if (!store) notFound();

  const products = (await readProducts()).filter(
    (product) => hasAvailableStock(product) && product.storeIds?.includes(store.id),
  );

  const initials = store.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const location = store.district !== "-" ? store.district : store.city;

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <Link
        href="/catalog"
        className="mb-8 inline-flex items-center gap-2 text-sm text-[#737D6C] hover:text-[#293C32]"
      >
        <ArrowLeft className="h-4 w-4" /> Бүх дэлгүүрүүд
      </Link>

      <div className="mb-10 flex flex-col gap-6 border-b border-[#293C32]/12 pb-10 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-2 border-[#293C32]/70 text-lg font-mono font-medium text-[#293C32]">
            {store.image ? (
              <Image
                src={store.image}
                alt={store.name}
                width={64}
                height={64}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <div>
            <h1 className="text-4xl text-[#293C32]">{store.name}</h1>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-[#6C726B]">
              <MapPin className="h-4 w-4 shrink-0" />
              {store.address !== "-" ? store.address : location}
            </p>
            {store.phone !== "-" && (
              <p className="mt-1 flex items-center gap-1.5 font-mono text-sm text-[#6C726B]">
                <Phone className="h-4 w-4 shrink-0" />
                {store.phone}
              </p>
            )}
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#6C726B]">
              {store.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {store.categories.map((c) => (
                <span
                  key={c}
                  className="rounded-sm bg-[#42634F]/10 px-2.5 py-1 font-mono text-xs text-[#42634F]"
                >
                  {CATEGORY_LABEL[c]}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="font-mono text-xs uppercase tracking-wide text-[#737D6C] mb-6">
        {products.length > 0
          ? `${products.length} бүтээгдэхүүн`
          : "Бүтээгдэхүүн"}
      </p>

      {products.length === 0 ? (
        <div className="grid place-items-center rounded-lg border border-dashed border-[#293C32]/20 bg-[#FFFFFF] p-16 text-center">
          <p className="text-2xl text-[#293C32]">
            Одоогоор бүтээгдэхүүн байршуулаагүй байна.
          </p>
          <p className="mt-2 text-sm text-[#737D6C]">
            Энэ дэлгүүр удахгүй бараагаа нэмэх болно.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

