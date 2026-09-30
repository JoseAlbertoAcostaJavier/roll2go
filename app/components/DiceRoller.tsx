"use client";

import { useState } from "react";

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

  return (
    <section className="roller card">
      <h2>Tirar dados</h2>
      <div className="quick">
        {QUICK.map((d) => (
          <button key={d} onClick={() => { setExpr(d); roll(d); }}>{d}</button>
        ))}
      </div>
      <div className="expr">
        <input
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && roll()}
          aria-label="Expresión de dados"
          placeholder="2d6+3"
        />
        <button className="btn" onClick={() => roll()}>Tirar</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className={`result ${crit}`} aria-live="polite">
        {last ? (
          <>
            <strong>{last.total}</strong>
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
        <ul className="history">
          {history.slice(1).map((h) => (
            <li key={h.id}><b>{h.total}</b> <small>{h.dice}</small></li>
          ))}
        </ul>
      )}
    </section>
  );
}
