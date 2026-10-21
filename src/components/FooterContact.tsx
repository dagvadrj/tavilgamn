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
    const reveal = () => {
      if (window.location.hash !== "#contact") return;
      if (details.current) details.current.open = true;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        document
          .getElementById("contact")
          ?.scrollIntoView({ block: "start", behavior: "instant" });
      });
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => {
      cancelAnimationFrame(frame);
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
