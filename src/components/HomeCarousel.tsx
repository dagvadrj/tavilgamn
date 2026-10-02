"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";

export function HomeCarousel({ children }: { children: ReactNode[] }) {
  const [current, setCurrent] = useState(0);
  const [reduced, setReduced] = useState(true);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(true);
  const count = children.length;

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReduced(preference.matches);
    const updateVisibility = () => setVisible(!document.hidden);
    updateMotion();
    updateVisibility();
    preference.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      preference.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (reduced || paused || interacting || focused || !visible || count < 2) return;
    const timer = window.setInterval(() => setCurrent(index => (index + 1) % count), 5000);
    return () => window.clearInterval(timer);
  }, [reduced, paused, interacting, focused, visible, count]);

  return <div className="market-carousel" role="region" aria-roledescription="слайд" aria-label="Тавилгын онцлох сонголтууд"
    onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)}
    onFocusCapture={() => setFocused(true)}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    {children.map((slide, index) => <div key={index} className="market-carousel-slide" hidden={index !== current}
      role="group" aria-roledescription="слайд" aria-label={`${index + 1} / ${count}`}>{slide}</div>)}
    {count > 1 && <div className="market-carousel-controls">
      <div className="market-carousel-dots" aria-label="Слайд сонгох">
        {children.map((_, index) => <button key={index} type="button" aria-label={`${index + 1}-р слайд үзэх`}
          aria-pressed={index === current} onClick={() => setCurrent(index)} />)}
      </div>
      <button className="market-carousel-pause" type="button" aria-label={reduced ? "Хөдөлгөөнийг багасгах тохиргоо идэвхтэй" : paused ? "Автоматаар солихыг эхлүүлэх" : "Автоматаар солихыг түр зогсоох"}
        aria-pressed={paused || reduced} disabled={reduced} onClick={() => setPaused(value => !value)}>
        {paused || reduced ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}
      </button>
    </div>}
  </div>;
}
