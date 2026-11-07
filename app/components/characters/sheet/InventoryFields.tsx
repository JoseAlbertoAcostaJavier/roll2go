"use client";

import { useState } from "react";
import { MAX_ITEM_NOTES, MAX_QUANTITY } from "@/lib/rules/dnd2024/sheet/edits";

export const smallInput =
  "h-8 rounded-md border border-line-strong bg-surface px-2 text-sm text-fg focus:border-brand focus:outline-none disabled:opacity-60";
export const clampInt = (v: string, max: number, fallback: number) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && v.trim() !== "" ? Math.min(max, Math.max(0, n)) : fallback;
};

// Campos con borrador propio: se guardan al salir del campo o con Intro
export function QuantityField({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setDraft(String(value));
  }
  const commit = () => {
    const v = clampInt(draft, MAX_QUANTITY, value);
    setDraft(String(v));
    if (v !== value) onCommit(v);
  };
  return (
    <input
      type="number" inputMode="numeric" min={0} max={MAX_QUANTITY} aria-label={label}
      className={`${smallInput} w-20`} value={draft}
      onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()}
    />
  );
}

export function NotesField({ label, value, onCommit }: { label: string; value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setDraft(value);
  }
  return (
    <input
      type="text" aria-label={label} maxLength={MAX_ITEM_NOTES} className={`${smallInput} w-full`} value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}
