"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

export type CommandItem = { id: string; label: string; group?: string };

/** ⌘K / Ctrl+K page search over the workspace navigation. */
export function DashboardCommand({
  items,
  open,
  onOpenChange,
  onSelect,
}: {
  items: CommandItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [onOpenChange]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setQuery("");
      setIndex(0);
      dialog.showModal();
    } else if (!open && dialog.open) dialog.close();
  }, [open]);
  const needle = query.trim().toLowerCase();
  const results = items.filter(
    (item) =>
      !needle ||
      item.label.toLowerCase().includes(needle) ||
      item.group?.toLowerCase().includes(needle),
  );
  const choose = (item: CommandItem | undefined) => {
    if (!item) return;
    onOpenChange(false);
    onSelect(item.id);
  };
  return (
    <dialog
      ref={dialogRef}
      className="dashboard-command"
      aria-label="Хуудас хайх"
      onClose={() => onOpenChange(false)}
      onClick={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <label className="dashboard-command-input">
        <Search size={16} aria-hidden="true" />
        <input
          autoFocus
          value={query}
          placeholder="Хуудас хайх…"
          aria-label="Хуудас хайх"
          aria-controls="dashboard-command-results"
          onChange={(event) => {
            setQuery(event.target.value);
            setIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setIndex((value) => Math.min(value + 1, results.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setIndex((value) => Math.max(value - 1, 0));
            } else if (event.key === "Enter") {
              event.preventDefault();
              choose(results[index]);
            }
          }}
        />
        <kbd>Esc</kbd>
      </label>
      <ul id="dashboard-command-results" role="listbox">
        {results.map((item, position) => (
          <li key={item.id} role="option" aria-selected={position === index}>
            <button
              type="button"
              tabIndex={-1}
              onMouseEnter={() => setIndex(position)}
              onClick={() => choose(item)}
            >
              <span>{item.label}</span>
              {item.group && <small>{item.group}</small>}
            </button>
          </li>
        ))}
        {!results.length && <li className="dashboard-command-empty">Олдсонгүй</li>}
      </ul>
    </dialog>
  );
}
