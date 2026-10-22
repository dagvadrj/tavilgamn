"use client";
import NextLink from "next/link";
import type { ComponentProps } from "react";
import { startPlannerNavigation } from "@/lib/plannerNavigation";

/** Next invokes onNavigate only for an actual same-tab navigation, after onClick. */
export function PlannerLink({
  href,
  onNavigate,
  ...props
}: ComponentProps<typeof NextLink>) {
  return (
    <NextLink
      {...props}
      href={href}
      onNavigate={(event) => {
        let cancelled = false;
        onNavigate?.({
          preventDefault: () => {
            cancelled = true;
            event.preventDefault();
          },
        });
        if (!cancelled && typeof href === "string")
          startPlannerNavigation(href);
      }}
    />
  );
}
