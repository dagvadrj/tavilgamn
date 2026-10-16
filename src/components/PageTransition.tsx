"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = container.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!element?.animate || reducedMotion.matches) return;
    // Animate the committed destination without delaying navigation or remounting its state.
    const animation = element.animate([{ opacity: 0.55 }, { opacity: 1 }], {
      duration: 240,
      easing: "ease-out",
    });
    const stop = () => {
      if (reducedMotion.matches) animation.cancel();
    };
    reducedMotion.addEventListener("change", stop);
    return () => {
      animation.cancel();
      reducedMotion.removeEventListener("change", stop);
    };
  }, [pathname]);

  return (
    <div ref={container} className="page-transition">
      {children}
    </div>
  );
}
