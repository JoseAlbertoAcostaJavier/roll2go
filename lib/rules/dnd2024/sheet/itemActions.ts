// Acciones que da llevar un objeto en el inventario: tocar una campana, verter aceite, beber una poción. Se deducen del texto
// del propio objeto, para que valga con cualquier libro. Módulo puro.
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import type { ItemData } from "@/lib/rules/types";
import { refKey } from "./equipmentRefs";
import type { InventoryItem } from "./sheet";

export type ItemAction = {
  key: string;
  lineId: string;
  name: string;
  group: "action" | "bonus";
  /** Frase del objeto que explica su uso. */
  details: string;
  /** Dados de curación, si el objeto cura. */
  healing: string | null;
};

const POTION_TYPE = "P";
const UTILIZE = /utilize action|acci[oó]n de (?:usar|utilizar)/i;
const BONUS = /bonus action|acci[oó]n adicional/i;
const HEALING = /(?:regains?|recupera[sn]?)\s+(\d+d\d+(?:\s*\+\s*\d+)?)\s+(?:hit points|puntos de golpe)/i;

// Verbo propio de los objetos que el jugador reconoce por lo que hacen; el resto, «Usar»
const VERBS: [RegExp, string][] = [[/\b(?:oil|aceite)\b/i, "Verter"], [/\b(?:bell|campana)\b/i, "Tocar"]];
const verbOf = (name: string) => VERBS.find(([re]) => re.test(name))?.[1] ?? "Usar";

const plain = (text: string) => text.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim();
const sentences = (text: string) => text.split(/(?<=[.!?])\s+/);

/** Una acción por línea del inventario que explique cómo se usa; las armas y armaduras van por su lado. */
export function itemActions(items: InventoryItem[], entries: Map<string, CatalogEntry>): ItemAction[] {
  return items.flatMap((line): ItemAction[] => {
    const entry = line.ref ? entries.get(refKey(line.ref)) : undefined;
    const data = entry?.data as ItemData | undefined;
    if (!entry || !data || data.weapon || data.armor || line.quantity < 1) return [];
    const text = plain(entry.descriptionEs || entry.description);
    const parts = sentences(text);
    const healing = HEALING.exec(text)?.[1].replace(/\s+/g, "") ?? null;
    const base = { key: `item:${line.id}`, lineId: line.id, healing };
    // Las pociones se beben con una acción adicional (reglas de 2024), lo diga o no su texto
    if (data.type === POTION_TYPE) {
      const details = parts.find((s) => BONUS.test(s)) ?? parts.find((s) => HEALING.test(s)) ?? parts[0] ?? "";
      const verb = /\b(?:oil|aceite)\b/i.test(line.name) ? "Aplicar" : "Beber";
      return [{ ...base, name: `${verb} ${line.name}`, group: "bonus", details }];
    }
    const bonus = parts.find((s) => BONUS.test(s));
    const utilize = parts.find((s) => UTILIZE.test(s));
    if (bonus) return [{ ...base, name: `${verbOf(line.name)} ${line.name}`, group: "bonus", details: bonus }];
    if (utilize) return [{ ...base, name: `${verbOf(line.name)} ${line.name}`, group: "action", details: utilize }];
    return [];
  });
}
