"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Dices, X } from "lucide-react";

type Mode = "normal" | "advantage" | "disadvantage";
type RollResult = { id: number; label: string; total: number; detail: string; note?: string };
type Api = { roll: (label: string, expr: string, d20: boolean) => void };

const RollContext = createContext<Api | null>(null);
const ModeContext = createContext<{ mode: Mode; setMode: (m: Mode) => void } | null>(null);

const MODES: { id: Mode; label: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "advantage", label: "Ventaja" },
  { id: "disadvantage", label: "Desventaja" },
];

type ApiRoll = { rolls: number[]; modifier: number; total: number };
async function fetchRoll(expr: string): Promise<ApiRoll> {
  const res = await fetch(`/api/roll?dice=${encodeURIComponent(expr)}`);
  if (!res.ok) throw new Error("tirada");
  return res.json();
}

// Tiradas de la ficha: el modo (normal, ventaja, desventaja) se aplica a las de d20 y los resultados aparecen abajo. No se
// guardan.
export function RollProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("normal");
  const [results, setResults] = useState<RollResult[]>([]);

  async function roll(label: string, expr: string, d20: boolean) {
    const id = Date.now();
    try {
      const two = d20 && mode !== "normal";
      const [a, b] = await Promise.all([fetchRoll(expr), two ? fetchRoll(expr) : Promise.resolve(null)]);
      const kept = !b ? a : (mode === "advantage" ? a.total >= b.total : a.total <= b.total) ? a : b;
      const mod = kept.modifier ? ` ${kept.modifier > 0 ? "+" : "−"} ${Math.abs(kept.modifier)}` : "";
      const detail = b ? `${a.rolls[0]} y ${b.rolls[0]} (${mode === "advantage" ? "ventaja" : "desventaja"})${mod}` : `${kept.rolls.join(" + ")}${mod}`;
      setResults((r) => [{ id, label, total: kept.total, detail }, ...r].slice(0, 3));
    } catch {
      setResults((r) => [{ id, label, total: 0, detail: "", note: "No se pudo tirar." }, ...r].slice(0, 3));
    }
  }

  return (
    <ModeContext.Provider value={{ mode, setMode }}>
      <RollContext.Provider value={{ roll }}>
        {children}
        {results.length > 0 && (
          <ul aria-live="polite" className="fixed bottom-20 left-1/2 z-40 w-72 max-w-[calc(100vw-2rem)] -translate-x-1/2 space-y-1.5 print:hidden">
            {results.map((r) => (
              <li key={r.id} className="flex animate-pop items-center gap-3 rounded-lg border border-line-strong bg-panel px-3 py-2 shadow-lg">
                {r.note ? <p className="flex-1 text-sm text-danger">{r.note}</p> : (
                  <>
                    <span className="font-heading text-2xl font-extrabold text-white">{r.total}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-fg">{r.label}</span>
                      <span className="block truncate text-xs text-muted">{r.detail}</span>
                    </span>
                  </>
                )}
                <button type="button" aria-label="Cerrar" onClick={() => setResults((all) => all.filter((x) => x.id !== r.id))} className="text-muted hover:text-white">
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </RollContext.Provider>
    </ModeContext.Provider>
  );
}

// Barra de modos de tirada
export function RollModeBar() {
  const ctx = useContext(ModeContext);
  if (!ctx) return null;
  return (
    <div role="radiogroup" aria-label="Modo de tirada" className="flex items-center gap-0.5 print:hidden">
      <Dices size={16} aria-hidden="true" className="mr-1.5 text-muted" />
      {MODES.map((m) => (
        <label
          key={m.id}
          className={`cursor-pointer rounded px-2.5 py-1 font-heading text-xs font-bold uppercase transition-colors has-focus-visible:outline-2 has-focus-visible:outline-brand-soft ${
            ctx.mode === m.id ? "bg-brand text-white" : "text-muted hover:text-white"
          }`}
        >
          <input type="radio" name="roll-mode" className="sr-only" checked={ctx.mode === m.id} onChange={() => ctx.setMode(m.id)} />
          {m.label}
        </label>
      ))}
    </div>
  );
}

// Valor que se tira al pulsarlo (golpe, daño…). Al imprimir se ve como texto
export function RollButton({ label, expr, d20 = false, className = "", children }: {
  label: string; expr: string; d20?: boolean; className?: string; children: ReactNode;
}) {
  const api = useContext(RollContext);
  if (!api) return <span className={className}>{children}</span>;
  return (
    <button
      type="button"
      data-print="text"
      title={`Tirar ${expr}`}
      aria-label={`Tirar ${label}: ${expr}`}
      onClick={() => api.roll(label, expr, d20)}
      className={`cursor-pointer rounded text-left underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand ${className}`}
    >
      {children}
    </button>
  );
}
