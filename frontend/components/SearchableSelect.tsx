"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export interface SearchableOption {
  value: string;
  /** Primary line, e.g. a material code. */
  label: string;
  /** Secondary line, e.g. a description. */
  description?: string;
  /** Right-aligned annotation, e.g. available stock. */
  meta?: string;
  disabled?: boolean;
  /** Extra text matched against the query but not displayed. */
  keywords?: string;
}

interface Props {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
}

/**
 * Ranks matches so the most specific win.
 *
 * A catalogue of a thousand materials makes a plain substring match useless: typing a code
 * buries the exact row among everything whose description happens to contain the same letters.
 * An exact code match sorts first, then a code prefix, then a word beginning, then anything.
 */
function score(option: SearchableOption, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const label = option.label.toLowerCase();
  const description = (option.description || "").toLowerCase();
  const keywords = (option.keywords || "").toLowerCase();

  if (label === q) return 0;
  if (label.startsWith(q)) return 1;
  if (description.startsWith(q)) return 2;
  // A match at a word boundary reads as intentional; mid-word is usually incidental.
  if (new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(description)) return 3;
  if (label.includes(q)) return 4;
  if (description.includes(q)) return 5;
  if (keywords.includes(q)) return 6;
  return -1;
}

/**
 * A type-to-search dropdown for lists too long to scroll.
 *
 * Keyboard: type to filter, up/down to move, Enter to choose, Escape to dismiss. The trigger is
 * a button rather than a text input so the chosen value stays legible when the list is closed.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Search...",
  emptyLabel = "No matches",
  loading = false,
  disabled = false,
  required = false,
  id,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const selected = useMemo(
    () => options.find((option) => option.value === value) || null,
    [options, value]
  );

  const matches = useMemo(() => {
    if (!query.trim()) return options;
    return options
      .map((option) => ({ option, rank: score(option, query) }))
      .filter((entry) => entry.rank >= 0)
      .sort((a, b) => a.rank - b.rank || a.option.label.localeCompare(b.option.label))
      .map((entry) => entry.option);
  }, [options, query]);

  useEffect(() => {
    setHighlighted(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setQuery("");
  }, [open]);

  const choose = (option: SearchableOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((current) => Math.min(current + 1, matches.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = matches[highlighted];
      if (option) choose(option);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        className="input input-bordered input-sm w-full flex items-center justify-between gap-2 text-left font-normal"
      >
        <span className={`truncate ${selected ? "" : "text-base-content/50"}`}>
          {selected ? selected.label : placeholder}
          {selected?.description ? (
            <span className="text-base-content/60"> — {selected.description}</span>
          ) : null}
        </span>
        <span className="material-symbols-outlined text-base shrink-0">
          {open ? "arrow_drop_up" : "arrow_drop_down"}
        </span>
      </button>

      {/* Mirrors the value into the form so native required-field validation still applies. */}
      {required ? (
        <input
          tabIndex={-1}
          aria-hidden="true"
          required
          value={value}
          onChange={() => undefined}
          className="sr-only absolute h-0 w-0 opacity-0"
        />
      ) : null}

      {open ? (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-base-300 bg-base-100 shadow-lg">
          <div className="p-2 border-b border-base-300">
            <input
              ref={inputRef}
              type="text"
              className="input input-bordered input-sm w-full"
              placeholder={placeholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
            />
          </div>
          <ul id={listboxId} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {loading ? (
              <li className="px-3 py-2 text-sm text-base-content/60">Loading...</li>
            ) : matches.length === 0 ? (
              <li className="px-3 py-2 text-sm text-base-content/60">{emptyLabel}</li>
            ) : (
              matches.map((option, index) => (
                <li key={option.value} role="option" aria-selected={option.value === value}>
                  <button
                    type="button"
                    disabled={option.disabled}
                    onMouseEnter={() => setHighlighted(index)}
                    onClick={() => choose(option)}
                    className={`w-full px-3 py-2 text-left text-sm flex items-start gap-2 ${
                      index === highlighted ? "bg-base-200" : ""
                    } ${option.disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold block truncate">{option.label}</span>
                      {option.description ? (
                        <span className="text-xs text-base-content/60 block truncate">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                    {option.meta ? (
                      <span className="text-xs text-base-content/60 shrink-0 tabular-nums">
                        {option.meta}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
          {!loading && matches.length > 0 ? (
            <div className="border-t border-base-300 px-3 py-1.5 text-xs text-base-content/50">
              {matches.length} of {options.length}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
