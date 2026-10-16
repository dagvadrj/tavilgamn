"use client";

import { RemotePage } from "@/components/RemotePage";
import type { PageData } from "@/lib/pageData";
import Link from "next/link";
import {
  ArrowUpRight,
  Factory,
  Hammer,
  Store as StoreIcon,
} from "lucide-react";
import { STORE_TYPES, isStoreType } from "@/lib/storeTypes";
import { CATEGORY_LABEL } from "@/lib/products";
import { DirectoryHeading } from "@/components/DirectoryHeading";
import { DirectoryCard } from "@/components/DirectoryCard";

const typeIcons = { factory: Factory, handmade: Hammer, retail: StoreIcon };

export function StoresPageClient({ type }: { type?: string }) {
  return (
    <RemotePage page="stores" variant="catalog">
      {(data) => <StoresContent {...data} type={type} />}
    </RemotePage>
  );
}

export function StoresContent({
  directory,
  productCounts,
  type,
}: PageData["stores"] & { type?: string }) {
  const selected = isStoreType(type) ? type : undefined;
  const activeType = STORE_TYPES.find((type) => type.id === selected);
  const stores = directory.filter(
    (store) => !selected || store.storeType === selected,
  );
  return (
    <div className="shop-container directory-page">
      <DirectoryHeading
        title={activeType?.label ?? "Дэлгүүрүүд"}
        eyebrow="Таны тавилгыг бүтээх хүмүүс"
        description={
          activeType?.description ??
          "Үйлдвэр, урлаач, бэлэн тавилгын дэлгүүрээс өөрт тохирохыг сонгоорой."
        }
        action={{ href: "/planner", label: "Өрөөгөө төлөвлөх" }}
      />
      <nav aria-label="Дэлгүүрийн төрөл" className="directory-filters">
        <Link
          href="/stores"
          aria-current={!selected ? "page" : undefined}
          className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm ${!selected ? "border-ui-line bg-ui-ink text-white" : "border-ui-line bg-white"}`}
        >
          Бүх дэлгүүр · {directory.length}
        </Link>
        {STORE_TYPES.map((type) => {
          const Icon = typeIcons[type.id];
          return (
            <Link
              key={type.id}
              href={`/stores?type=${type.id}`}
              aria-current={selected === type.id ? "page" : undefined}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm ${selected === type.id ? "border-ui-line bg-ui-ink text-white" : "border-ui-line bg-white hover:bg-ui-bg"}`}
            >
              <Icon size={16} aria-hidden="true" />
              {type.label}
              <span className="opacity-70">
                {
                  directory.filter((store) => store.storeType === type.id)
                    .length
                }
              </span>
            </Link>
          );
        })}
      </nav>
      {stores.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ui-line bg-white px-6 py-16 text-center">
          <Hammer
            size={32}
            aria-hidden="true"
            className="mx-auto mb-4 text-[#42634F]"
          />
          <h2 className="text-xl font-medium">
            Энэ төрөлд дэлгүүр хараахан нэмэгдээгүй байна
          </h2>
          <p className="mt-3 text-sm text-ui-muted">
            Шинэ дэлгүүр бүртгэгдмэгц энд харагдана.
          </p>
          <Link
            href="/stores"
            className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4"
          >
            Бүх дэлгүүрийг үзэх <ArrowUpRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="directory-grid">
          {stores.map((store) => (
            <DirectoryCard
              key={store.id}
              href={`/catalog/stores/${store.id}`}
              title={store.name}
              image={store.image}
              badge={
                STORE_TYPES.find((type) => type.id === store.storeType)
                  ?.label ?? "Дэлгүүр"
              }
              description={store.description}
              location={[store.city, store.district !== "-" && store.district]
                .filter(Boolean)
                .join(" · ")}
              tags={store.categories
                .slice(0, 3)
                .map((category) => CATEGORY_LABEL[category])}
              summary={{
                label: "Нийт тавилга",
                value: `${productCounts[store.id] ?? 0} тавилга`,
              }}
              action="Дэлгүүр үзэх"
            />
          ))}
        </div>
      )}
    </div>
  );
}
