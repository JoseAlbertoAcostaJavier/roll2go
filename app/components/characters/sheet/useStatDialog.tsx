"use client";

import { useState, type ReactNode } from "react";
import type { Breakdown } from "@/lib/rules/dnd2024/derive";
import { ABILITY_NAMES, skillName } from "@/lib/rules/dnd2024/sheet/labels";
import {
  ABILITY_TEXTS, AC_TEXT, DEFENSES_TEXT, INITIATIVE_TEXT, saveText, SKILL_TEXTS, SPEED_TEXT, type BreakdownUnit,
} from "@/lib/rules/dnd2024/sheet/statTexts";
import { DEFENSE_GROUPS, defenseLabel } from "./DefensesBox";
import { abbr } from "./statUi";
import type { SheetData, ShowStat, Stat } from "./types";

// Valor abierto en el diálogo y el botón que lo abrió
type Open = { stat: Stat; opener: HTMLElement };
export type Detail = {
  title: string; subject?: string; description: string; breakdown?: Breakdown; unit?: BreakdownUnit; children?: ReactNode;
};

/** Estado del diálogo de desglose, compartido por todas las cajas de la ficha (un único `StatDialog`). */
export function useStatDialog(d: SheetData) {
  const [open, setOpen] = useState<Open | null>(null);

  // El botón se captura al pulsar (Safari no lo enfoca)
  const show: ShowStat = (stat) => (e) => setOpen({ stat, opener: e.currentTarget });
  const close = () => setOpen(null);

  // Título, descripción y desglose del valor abierto
  function detail(stat: Stat): Detail {
    const b = d.breakdowns;
    switch (stat.kind) {
      case "ability": {
        const name = ABILITY_NAMES[stat.ability];
        return {
          title: name, subject: `tu puntuación de ${name}`, description: ABILITY_TEXTS[stat.ability],
          breakdown: b.abilities[stat.ability], unit: "plain",
        };
      }
      case "save": {
        const name = ABILITY_NAMES[stat.ability];
        return {
          title: `Salvación de ${name}`, subject: `la tirada de salvación de ${name}`, description: saveText(stat.ability),
          breakdown: b.saves[stat.ability],
        };
      }
      case "skill": {
        const title = `${skillName(stat.id)} (${abbr(stat.ability)})`;
        return { title, subject: title, description: SKILL_TEXTS[stat.id], breakdown: b.skills[stat.id] };
      }
      case "ac":
        return { title: "Clase de armadura", subject: "la Clase de armadura", description: AC_TEXT, breakdown: b.ac, unit: "plain" };
      case "initiative":
        return { title: "Iniciativa", subject: "la iniciativa", description: INITIATIVE_TEXT, breakdown: b.initiative };
      case "speed":
        return { title: "Velocidad", subject: "la velocidad", description: SPEED_TEXT, breakdown: b.speed, unit: "feet" };
      case "defenses":
        return {
          title: "Defensas", description: DEFENSES_TEXT,
          children: DEFENSE_GROUPS.map((g) => {
            const rows = d.defenses.filter((r) => r.kind === g.kind);
            if (rows.length === 0) return null;
            return (
              <section key={g.kind} className="mb-3 last:mb-0">
                <h4 className="mb-1 text-sm font-semibold">{g.title}</h4>
                <ul className="divide-y divide-line text-sm">
                  {rows.map((r) => (
                    <li key={r.type ?? "?"} className="py-1.5">
                      {defenseLabel(r)} <span className="text-muted">· {r.sources.join(", ")}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          }),
        };
    }
  }

  return { open, show, close, detail };
}
