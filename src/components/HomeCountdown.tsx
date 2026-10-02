"use client";

import { useEffect, useState } from "react";
import { marketplaceDayDigits } from "@/lib/homeMarketplace";

/** The daily selection clock is not a product's promotion expiration date. */
export function HomeCountdown() {
  const [digits, setDigits] = useState<[string, string, string]>(["--", "--", "--"]);
  useEffect(() => {
    let timer: number | undefined;
    const tick = () => setDigits(marketplaceDayDigits(Date.now()));
    const sync = () => {
      window.clearInterval(timer);
      if (document.hidden) return;
      tick();
      timer = window.setInterval(tick, 1000);
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  return <div className="market-countdown">
    <span>Өнөөдөр үлдсэн</span>
    <div role="timer" aria-label={`Улаанбаатарын цагаар өдөр дуусах хүртэл ${digits[0]} цаг ${digits[1]} минут ${digits[2]} секунд`} aria-live="off">
      {digits.map((value, index) => <span key={index}>{index > 0 && <i aria-hidden="true">:</i>}<b>{value}</b></span>)}
    </div>
  </div>;
}
