"use client";

import { useId, useState } from "react";
import { Plus, X } from "lucide-react";
import { kitchenListTokens } from "@/lib/kitchenListingSuggestions";

export function KitchenTokenInput({
  label,
  value,
  onChange,
  suggestions = [],
  placeholder = "Өөрөө нэмэх…",
  maxItems = 50,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suggestions?: string[];
  placeholder?: string;
  maxItems?: number;
  disabled?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const tokens = kitchenListTokens(value);
  const add = (text: string) => {
    const next = kitchenListTokens([...tokens, draft, text].join("\n"));
    if (next.length > maxItems || next.some((item) => item.length > 200)) {
      setError(`${maxItems} хүртэл зүйл, нэг нь 200 хүртэл тэмдэгт байна.`);
      return;
    }
    onChange(next.join("\n"));
    setDraft("");
    setError("");
  };
  const remove = (token: string) =>
    onChange(tokens.filter((item) => item !== token).join("\n"));
  const selected = new Set(tokens.map((item) => item.toLocaleLowerCase("mn")));
  return (
    <div className="km-field km-token-field">
      <label htmlFor={id}>{label}</label>
      <div className="km-token-control" aria-disabled={disabled}>
        {tokens.map((token) => (
          <span className="km-token" key={token}>
            <span>{token}</span>
            <button
              type="button"
              disabled={disabled}
              aria-label={`${token} хасах`}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => remove(token)}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          disabled={disabled}
          maxLength={200}
          placeholder={placeholder}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={Boolean(error)}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (draft.trim()) add(draft);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              if (draft.trim()) add(draft);
            }
            if (event.key === "Backspace" && !draft && tokens.length)
              remove(tokens[tokens.length - 1]);
          }}
        />
      </div>
      <div
        className="km-suggestions"
        aria-label={`${label} санал болгох сонголтууд`}
      >
        {suggestions
          .filter((item) => !selected.has(item.toLocaleLowerCase("mn")))
          .slice(0, 24)
          .map((item) => (
            <button
              key={item}
              type="button"
              disabled={disabled || tokens.length >= maxItems}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => add(item)}
            >
              <Plus size={11} />
              {item}
            </button>
          ))}
      </div>
      {error && (
        <p id={`${id}-error`} className="km-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
