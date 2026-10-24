"use client";

import { useEffect } from "react";
import { MotionHomepage } from "@/features/home-motion/MotionHomepage";
import { Header } from "@/components/Header";
import { useAdminResource } from "@/features/dashboard/useAdminResource";
import type { PageData } from "@/lib/pageData";
import type { HomepageHero } from "@/lib/homepagePresentation";
import "@/app/(shop)/shop-tokens.css";
import "@/app/(shop)/storefront.css";
import "@/app/(shop)/styles/mobile-shop.css";
import "@/app/(shop)/styles/storefront-polish.css";

export default function HomepagePreviewContent({
  owner,
  hero,
  productIds,
  onSelect,
  onProducts,
}: {
  owner: string;
  hero: HomepageHero;
  productIds: string[];
  onSelect: (field: string) => void;
  onProducts: (products: { id: string; name: string }[]) => void;
}) {
  const resource = useAdminResource<PageData["home"]>(
    owner,
    "/api/page-data/home",
  );
  useEffect(() => {
    onProducts(
      resource.data?.catalog
        .filter(
          (product) =>
            product.model &&
            product.category === "sofa" &&
            /^[0-9a-f-]{36}$/i.test(product.id),
        )
        .map((product) => ({ id: product.id, name: product.name })) ?? [],
    );
  }, [resource.data, onProducts]);
  return (
    <div
      className="site-ui shop-shell"
      onSubmitCapture={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClickCapture={(event) => {
        const target = event.target as Element;
        if (target.closest("a, .home-shopping button")) {
          event.preventDefault();
          event.stopPropagation();
        }
        const field = target.closest<HTMLElement>("[data-homepage-field]")
          ?.dataset.homepageField;
        if (field) {
          event.preventDefault();
          event.stopPropagation();
          onSelect(field);
        }
      }}
    >
      <Header />
      <MotionHomepage
        {...(resource.data ?? { catalog: [], stores: [], paymentLabels: [] })}
        homepageHero={hero}
        homepageProductIds={productIds}
        loading={resource.loading && !resource.data}
        error={!!resource.error}
        onRetry={resource.refresh}
      />
    </div>
  );
}
