"use client";
import { useEffect, type RefObject } from "react";

const dashboardCards =
  ".reference-kpi, .merchant-stat-panel, .merchant-progress-card, .merchant-form-card, .merchant-panel, .dashboard-panel, .merchant-product, .reference-panel, .reference-store-banner, .km-design-row, .mk-card, .reference-orders, .reference-table-card, .reference-inspector, .admin-panel, .admin-model-request, .admin-model-request-stats > span, .dashboard-form-section, .product-editor-section";
const dashboardHeadings =
  ".reference-heading > *, .merchant-section-heading > *, .admin-page-heading > *, .admin-model-request-heading > *";
const excluded =
  ".merchant-sortable-card.is-editing, .merchant-sortable-overlay, .merchant-delivery-pipeline, [role=dialog]";

/** Finite, once-per-element reveals; the underlying DOM always stays visible. */
export function DashboardMotion({
  page,
  rootRef,
  cards = dashboardCards,
  headings = dashboardHeadings,
}: {
  page: string;
  rootRef: RefObject<HTMLElement | null>;
  cards?: string;
  headings?: string;
}) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !("IntersectionObserver" in window)) return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const registered = new WeakSet<Element>();
    const pending = new Set<Element>();
    const running = new Map<Element, Animation>();
    const cancel = (node: Element) => {
      if (!running.has(node)) return;
      running.get(node)?.cancel();
      running.delete(node);
      observer.unobserve(node);
    };
    const settle = () => {
      running.forEach((animation) => animation.cancel());
      running.clear();
      pending.forEach((node) => observer.unobserve(node));
      pending.clear();
    };
    const observer = new IntersectionObserver(
      (entries) => {
        let headingIndex = 0;
        let cardIndex = 0;
        for (const { target, isIntersecting } of entries) {
          if (!isIntersecting) {
            cancel(target);
            continue;
          }
          // A queued callback may arrive after a preference/focus change.
          if (!pending.delete(target)) continue;
          if (
            preference.matches ||
            document.hidden ||
            target.closest(excluded) ||
            target.contains(document.activeElement) ||
            typeof target.animate !== "function"
          ) {
            observer.unobserve(target);
            continue;
          }
          const heading = target.matches(headings);
          const animation = target.animate(
            [
              {
                opacity: 0,
                transform: heading
                  ? "translateY(12px)"
                  : "translateY(20px) scale(0.985)",
              },
              { opacity: 1, transform: "translateY(0) scale(1)" },
            ],
            {
              duration: heading ? 680 : 880,
              delay: heading
                ? Math.min(headingIndex++ * 70, 210)
                : 100 + Math.min(cardIndex++ * 90, 360),
              easing: "cubic-bezier(0.16, 1, 0.3, 1)",
              fill: "backwards",
            },
          );
          running.set(target, animation);
          animation.onfinish = () => {
            running.delete(target);
            observer.unobserve(target);
            animation.cancel();
          };
        }
      },
      { threshold: 0.05 },
    );
    const attach = (node: Element) => {
      for (const target of [
        node,
        ...node.querySelectorAll(`${cards}, ${headings}`),
      ]) {
        if (
          !target.matches(`${cards}, ${headings}`) ||
          registered.has(target) ||
          target.closest(excluded) ||
          // Reveal a panel as one unit, leaving sortable wrapper transforms alone.
          target.parentElement?.closest(cards)
        )
          continue;
        registered.add(target);
        if (preference.matches || document.hidden) continue;
        pending.add(target);
        observer.observe(target);
      }
    };
    attach(root);
    const changes = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "attributes") {
          if (
            (record.target as Element).matches(
              ".merchant-sortable-card.is-editing",
            )
          )
            settle();
          continue;
        }
        for (const node of record.addedNodes)
          if (node instanceof Element) attach(node);
      }
      // Discard removed async panels rather than retaining their DOM nodes.
      for (const node of pending)
        if (!root.contains(node)) {
          observer.unobserve(node);
          pending.delete(node);
        }
      for (const node of running.keys()) if (!root.contains(node)) cancel(node);
    });
    changes.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    const onVisibility = () => {
      if (document.hidden) settle();
    };
    const onPreference = () => {
      if (preference.matches) settle();
    };
    const onFocus = (event: FocusEvent) => {
      const focused = event.target;
      if (!(focused instanceof Element)) return;
      for (const node of pending)
        if (node.contains(focused)) {
          observer.unobserve(node);
          pending.delete(node);
        }
      for (const node of running.keys())
        if (node.contains(focused)) cancel(node);
    };
    root.addEventListener("focusin", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    preference.addEventListener("change", onPreference);
    return () => {
      changes.disconnect();
      settle();
      observer.disconnect();
      root.removeEventListener("focusin", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      preference.removeEventListener("change", onPreference);
    };
  }, [page, rootRef, cards, headings]);
  return null;
}
