"use client";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** The same-tab, same-origin page change a click on this anchor would start, if any. */
export function navigationTarget(
  anchor: HTMLAnchorElement,
  event: Pick<MouseEvent, "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">,
  currentHref: string,
) {
  // Not defaultPrevented: next/link always cancels the click to route itself.
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    (anchor.target && anchor.target !== "_self") ||
    anchor.hasAttribute("download")
  )
    return null;
  try {
    const current = new URL(currentHref);
    const target = new URL(anchor.href, current);
    if (target.origin !== current.origin) return null;
    // A hash on the same page scrolls; it never loads anything.
    if (target.pathname === current.pathname && target.search === current.search)
      return null;
    if (target.pathname.startsWith("/api/")) return null;
    return target.pathname + target.search;
  } catch {
    return null;
  }
}

/**
 * Immediate feedback for every internal link: a top bar appears in the same
 * click, before the router has anything to show, and leaves when the URL
 * changes. Slow connections get a message instead of a silent wait.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [active, setActive] = useState(false);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (!navigationTarget(anchor, event, window.location.href)) return;
      setSlow(false);
      setActive(true);
    };
    const reset = () => {
      setActive(false);
      setSlow(false);
    };
    document.addEventListener("click", onClick);
    window.addEventListener("pageshow", reset);
    window.addEventListener("popstate", reset);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("pageshow", reset);
      window.removeEventListener("popstate", reset);
    };
  }, []);

  // The destination is mounted once the URL changes.
  useEffect(() => {
    setActive(false);
    setSlow(false);
  }, [pathname, search]);

  useEffect(() => {
    if (!active) return;
    const slowTimer = window.setTimeout(() => setSlow(true), 8000);
    // Never leave the bar running if a navigation was abandoned silently.
    const giveUp = window.setTimeout(() => setActive(false), 30000);
    return () => {
      window.clearTimeout(slowTimer);
      window.clearTimeout(giveUp);
    };
  }, [active]);

  if (!active) return null;
  return (
    <>
      <div className="navigation-progress" aria-hidden="true">
        <span />
      </div>
      {slow && (
        <p className="navigation-progress-slow" role="status">
          Холболт удаж байна. Хуудсыг ачаалж байна…
        </p>
      )}
    </>
  );
}
