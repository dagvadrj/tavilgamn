"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { ContactForm } from "./ContactForm";

export function FooterContact() {
  const params = useSearchParams();
  const requested = params.get("topic");
  const topic =
    requested === "merchant" || requested === "advertising"
      ? requested
      : "general";
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    let frame = 0;
    let target: string | null = null;
    const align = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (target)
          document
            .getElementById(target)
            ?.scrollIntoView({ block: "start", behavior: "instant" });
      });
    };
    // Pages such as the home page render a short skeleton first, so the footer
    // is already in view when the router handles the hash and later content
    // pushes it down. Keep the footer anchor aligned while the page grows,
    // until the visitor scrolls on their own.
    const release = () => {
      target = null;
    };
    const reveal = () => {
      const hash = window.location.hash.slice(1);
      if (hash !== "contact" && hash !== "about") return;
      if (hash === "contact" && details.current) details.current.open = true;
      target = hash;
      align();
    };
    const growth = new ResizeObserver(() => {
      if (target) align();
    });
    growth.observe(document.body);
    const settled = window.setTimeout(release, 5000);
    const userScroll = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    for (const type of userScroll)
      window.addEventListener(type, release, { passive: true });
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => {
      cancelAnimationFrame(frame);
      growth.disconnect();
      window.clearTimeout(settled);
      for (const type of userScroll) window.removeEventListener(type, release);
      window.removeEventListener("hashchange", reveal);
    };
  }, [params]);
  return (
    <details ref={details} className="mt-3 max-w-2xl">
      <summary className="flex min-h-11 w-fit cursor-pointer items-center text-sm underline underline-offset-4">
        Зурвас илгээх
      </summary>
      <div className="mt-3 rounded-2xl bg-white text-[#111111]">
        <ContactForm key={topic} initialTopic={topic} />
      </div>
    </details>
  );
}
