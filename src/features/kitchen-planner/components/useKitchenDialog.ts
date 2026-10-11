"use client";
import { useEffect, useRef } from "react";

export function useKitchenDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open || !ref.current) return;
    const panel = ref.current,
      previous = document.activeElement as HTMLElement | null;
    const controls = () =>
      [
        ...panel.querySelectorAll<HTMLElement>(
          "button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex='0']",
        ),
      ].filter((el) => el.getClientRects().length);
    controls()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
      }
      if (event.key !== "Tab") return;
      const items = controls(),
        first = items[0],
        last = items.at(-1);
      if (!first) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !panel.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !panel.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    panel.addEventListener("keydown", key);
    return () => {
      panel.removeEventListener("keydown", key);
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);
  return ref;
}
