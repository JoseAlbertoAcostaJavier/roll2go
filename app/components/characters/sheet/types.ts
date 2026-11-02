import type { Derived } from "@/lib/rules/dnd2024/derive";
import type { Ability } from "@/lib/rules/types";

/** Los valores derivados que muestran las cajas de la ficha (solo esos viajan al navegador). */
export type SheetData = Pick<Derived,
  | "abilities" | "proficiencyBonus" | "hp" | "ac" | "armorWarning" | "initiative" | "speed" | "darkvision" | "saves"
  | "skills" | "armor" | "weapons" | "tools" | "languages" | "breakdowns" | "defenses">;

/** Valor que abre su desglose en el diálogo (uno a la vez). */
export type Stat =
  | { kind: "ability" | "save"; ability: Ability }
  | { kind: "skill"; id: string; ability: Ability }
  | { kind: "ac" | "initiative" | "speed" | "defenses" };

/** Abre el desglose de un valor; el botón se captura al pulsar (Safari no lo enfoca). */
export type ShowStat = (stat: Stat) => (e: React.MouseEvent<HTMLElement>) => void;

/** Inspiración heroica, estados y agotamiento de la hoja (`statusOf`). */
export type StatusState = { heroicInspiration: boolean; conditions: string[]; exhaustion: number };
