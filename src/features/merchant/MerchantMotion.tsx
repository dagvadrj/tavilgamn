"use client";
import { useEffect } from "react";
export function MerchantMotion({ page }: { page: string }) {
  useEffect(() => {
    const root = document.querySelector(".merchant-content");
    if (
      !root ||
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const observer = new IntersectionObserver(
      (items) => {
        for (const item of items)
          if (item.isIntersecting) {
            item.target.classList.add("is-revealed");
            observer.unobserve(item.target);
          }
      },
      { threshold: 0.05 },
    );
    const selector =
      ".merchant-stat-panel, .merchant-progress-card, .merchant-form-card, .merchant-panel, .dashboard-panel, .merchant-product, .reference-panel, .km-design-row, .mk-card";
    const attach = (node: Element) => {
      for (const target of [
        node,
        ...Array.from(node.querySelectorAll(selector)),
      ])
        if (
          target.matches(selector) &&
          !target.closest(".merchant-sortable-card,.merchant-delivery-pipeline")
        ) {
          target.classList.add("merchant-reveal");
          observer.observe(target);
        }
    };
    attach(root);
    const changes = new MutationObserver((records) =>
      records.forEach((record) =>
        record.addedNodes.forEach((node) => {
          if (node instanceof Element) attach(node);
        }),
      ),
    );
    changes.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      changes.disconnect();
      root
        .querySelectorAll(".merchant-reveal")
        .forEach((n) => n.classList.remove("merchant-reveal", "is-revealed"));
    };
  }, [page]);
  return null;
}
