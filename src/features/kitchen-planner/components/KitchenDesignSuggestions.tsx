"use client";

import { useMemo, useState } from "react";
import type { ModularKitchen } from "@/lib/kitchenCabinets";
import { kitchenDesignSuggestions } from "@/lib/kitchenDesignSuggestions";
import { Plan } from "./PlannerPanels";
import "./kitchen-design-suggestions.css";


export function KitchenDesignSuggestions({ kitchen, disabled, onApply, onBack, onFinish }: {
  kitchen: ModularKitchen; disabled: boolean;
  onApply: (next: ModularKitchen) => boolean;
  onBack: () => void; onFinish: () => void;
}) {
  const [error, setError] = useState("");
  const suggestions = useMemo(() => kitchenDesignSuggestions(kitchen), [kitchen]);
  return <section className="kitchen-suggestions" aria-label="Гал тогооны таван санал">
    <p>АЛХАМ 6 / 7</p><h1>Таны загварт тулгуурласан 5 санал</h1>
    <p>Өрөөний хэмжээ, холболт болон сонгосон шүүгээнүүдийг ашиглана. Байрлал багтахгүй бол одоогийн байрлалд өнгөний хувилбар санал болгоно.</p>
    <div className="kitchen-suggestion-grid">{suggestions.map((suggestion, index) => <article key={suggestion.layout}>
      <h2>{index + 1}. {suggestion.fits ? suggestion.title : "Өнгөний хувилбар"}</h2>
      <Plan kitchen={suggestion.design} selectedId={null} onSelect={() => {}} readOnly unit="см" />
      {!suggestion.fits && <p><span style={{ background: suggestion.color, display: "inline-block", width: 18, height: 18 }} /> Одоогийн байрлалыг хадгална</p>}
      {suggestion.issue && <p role="status">{suggestion.issue.message}</p>}
      <button type="button" disabled={disabled || !!suggestion.issue} onClick={() => {
        if (onApply(suggestion.design)) { setError(""); onBack(); }
        else setError("Саналыг ашиглаж чадсангүй. Загвараа шалгаад дахин оролдоорой.");
      }}>Энэ саналыг ашиглах</button>
    </article>)}</div>
    {error && <p role="alert">{error}</p>}
    <footer><button type="button" onClick={onBack}>Өөрөө тохижуулах руу буцах</button><button type="button" disabled={disabled} onClick={onFinish}>Одоогийн загвараар дуусгах →</button></footer>
  </section>;
}
