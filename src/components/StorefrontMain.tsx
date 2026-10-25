"use client";

import { useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DashboardMotion } from "@/features/dashboard/DashboardMotion";

export function StorefrontMain({ children }: { children: ReactNode }) {
  const root = useRef<HTMLElement>(null);
  const pathname = usePathname();
  return (
    <main id="main-content" className="min-w-0 flex-1" ref={root}>
      {children}
      <DashboardMotion
        page={pathname}
        rootRef={root}
        cards=".clean-product-card, .home-store-list > a, .category-room-card"
        headings=".catalog-heading, .home-shopping .home-section-heading"
      />
    </main>
  );
}
