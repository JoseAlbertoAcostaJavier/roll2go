"use client";

import { useState } from "react";
/*
  Roll define la estructura de un lanzamiento de dados. 
  Quick es un array de expresiones de dados predefinidas para lanzamientos rápidos.
  DiceRoller es un componente que permite a los usuarios lanzar dados, manteniendo un historial de dichos
  lanzamientos. Su funcionamiento esta basado en /roll/route.ts, que es la API que procesa la expresión de dados 
  y devuelve el resultado.
*/
type Roll = { id: string; dice: string; sides: number; rolls: number[]; modifier: number; total: number };
const QUICK = ["1d4", "1d6", "1d8", "1d10", "1d12", "1d20", "1d100"];

export default function DiceRoller() {
  const [expr, setExpr] = useState("1d20");
  const [history, setHistory] = useState<Roll[]>([]);
  const [error, setError] = useState("");

  async function roll(dice: string = expr) {
    setError("");
    try {
      const res = await fetch(`/api/roll?dice=${encodeURIComponent(dice)}`);
      const data = await res.json();
      if (!res.ok) return setError(data.error);
      setHistory((h) => [{ ...data, id: crypto.randomUUID() }, ...h].slice(0, 8));
    } catch {
      setError("No se pudo conectar con el servidor.");
    }
  }

  const last = history[0];
  const single = last && last.sides === 20 && last.rolls.length === 1;
  const crit = single ? (last.rolls[0] === 20 ? "crit" : last.rolls[0] === 1 ? "fail" : "") : "";

  // Colores del cuadro de resultado: verde en 20 natural, rojo en 1, gris en el resto
  const tone =
    crit === "crit"
      ? { box: "border-[#6fd08c]", num: "text-[#6fd08c]" }
      : crit === "fail"
        ? { box: "border-brand", num: "text-brand" }
        : { box: "border-line", num: "text-fg" };

  return (
    <section className="rounded-lg border border-line bg-panel p-5">
      <h2 className="mb-3.5 font-heading text-[1.15rem] font-bold">Tirar dados</h2>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {QUICK.map((d) => (
          <button
            key={d}
            onClick={() => { setExpr(d); roll(d); }}
            className="rounded-md border border-line bg-surface px-3 py-1.5 font-heading text-[.85rem] font-semibold text-fg transition-colors hover:border-brand hover:text-brand-soft focus-visible:border-brand focus-visible:text-brand-soft"
          >
            {d}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && roll()}
          aria-label="Expresión de dados"
          placeholder="2d6+3"
          className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2.5 text-base text-fg"
        />
        <button
          onClick={() => roll()}
          className="rounded-md bg-brand px-5 py-2.5 font-heading text-[.95rem] font-bold text-white transition-colors hover:bg-brand-hover"
        >
          Tirar
        </button>
      </div>

      {error && <p className="mt-2.5 text-sm text-brand-soft" role="alert">{error}</p>}

      <div
        className={`mt-4 flex min-h-24 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed p-2 text-center text-muted ${tone.box}`}
        aria-live="polite"
      >
        {last ? (
          <>
            <strong className={`font-heading text-[3.4rem] font-extrabold leading-none ${tone.num}`}>
              {last.total}
            </strong>
            <span>
              {last.dice} → [{last.rolls.join(", ")}]
              {last.modifier ? ` ${last.modifier > 0 ? "+" : ""}${last.modifier}` : ""}
            </span>
          </>
        ) : (
          <span>Selecciona una de las opciones.</span>
        )}
      </div>

      {history.length > 1 && (
        <ul className="mt-3 flex flex-wrap gap-2.5 text-muted">
          {history.slice(1).map((h) => (
            <li key={h.id}><b className="text-fg">{h.total}</b> <small>{h.dice}</small></li>
          ))}
        </ul>
      )}
    </section>
  );
}