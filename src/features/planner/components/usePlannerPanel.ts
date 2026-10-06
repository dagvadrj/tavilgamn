"use client";

import { useEffect, useRef } from "react";

/** Mobile inspectors behave as dismissible dialogs; desktop inspectors stay persistent. */
export function usePlannerPanel(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const media = window.matchMedia("(max-width: 959px)");
    let release: (() => void) | undefined;
    const update = () => {
      release?.(); release = undefined;
      const panel = ref.current;
      if (!media.matches || !panel) return;
      const previous = document.activeElement as HTMLElement | null;
      const overflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true");
      const elements = () => Array.from(panel.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]',
      )).filter(element => element.getClientRects().length);
      elements()[0]?.focus();
      const key = (event: KeyboardEvent) => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close.current(); }
        if (event.key !== "Tab") return;
        const items = elements(), first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      };
      panel.addEventListener("keydown", key);
      release = () => {
        panel.removeEventListener("keydown", key);
        panel.removeAttribute("role"); panel.removeAttribute("aria-modal");
        document.body.style.overflow = overflow;
        if (previous?.isConnected) previous.focus();
      };
    };
    update(); media.addEventListener("change", update);
    return () => { media.removeEventListener("change", update); release?.(); };
  }, [open]);
  return ref;
}
