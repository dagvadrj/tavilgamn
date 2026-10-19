"use client";

import { RemotePage } from "@/components/RemotePage";
import type { PageData } from "@/lib/pageData";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, MapPin, Phone, BadgeCheck } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { STORE_TYPES } from "@/lib/storeTypes";
import { CATEGORY_LABEL } from "@/lib/products";

export function StorePageClient({
  id,
  verified = false,
}: {
  id: string;
  verified?: boolean;
}) {
  return (
    <RemotePage page="store" id={id} variant="catalog">
      {(data) => <StoreContent {...data} verified={verified} />}
    </RemotePage>
  );
}

export function StoreContent({
  store,
  products,
  verified = false,
}: PageData["store"] & { verified?: boolean }) {
  const initials = store.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const location = store.district !== "-" ? store.district : store.city;

  return (
    <div className="ui-page">
      <title>{`${store.name} — tavilga.mn`}</title>
      <Link
        href="/stores"
        className="mb-8 inline-flex items-center gap-2 text-sm text-ui-muted hover:text-ui-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Бүх дэлгүүрүүд
      </Link>

      <div className="mb-10 flex flex-col gap-6 border-b border-ui-line pb-10 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-2 border-ui-line text-lg font-mono font-medium text-ui-ink">
            {store.image ? (
              <Image
                src={store.image}
                alt={store.name}
                width={64}
                height={64}
                unoptimized
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <div>
            <h1 className="ui-title">{store.name}</h1>
            {verified && (
              <span className="inline-flex items-center gap-1.5 text-sm text-ui-accent">
                <BadgeCheck size={16} /> Verified Merchant
              </span>
            )}
            <Link
              href={`/stores?type=${store.storeType}`}
              className="mt-2 inline-block text-xs font-medium text-ui-accent underline underline-offset-4"
            >
              {STORE_TYPES.find((type) => type.id === store.storeType)?.label}
            </Link>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-ui-muted">
              <MapPin className="h-4 w-4 shrink-0" />
              {store.address !== "-" ? store.address : location}
            </p>
            {store.phone !== "-" && (
              <p className="mt-1 flex items-center gap-1.5 font-mono text-sm text-ui-muted">
                <Phone className="h-4 w-4 shrink-0" />
                {store.phone}
              </p>
            )}
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-ui-muted">
              {store.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {store.categories.map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-ui-selected px-3 py-1 text-xs text-ui-accent"
                >
                  {CATEGORY_LABEL[c]}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="ui-eyebrow mb-6">
        {products.length > 0
          ? `${products.length} бүтээгдэхүүн`
          : "Бүтээгдэхүүн"}
      </p>

      {products.length === 0 ? (
        <div className="grid place-items-center rounded-lg border border-dashed border-ui-line bg-ui-surface p-16 text-center">
          <p className="text-2xl text-ui-ink">
            Одоогоор бүтээгдэхүүн байршуулаагүй байна.
          </p>
          <p className="mt-2 text-sm text-ui-muted">
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
