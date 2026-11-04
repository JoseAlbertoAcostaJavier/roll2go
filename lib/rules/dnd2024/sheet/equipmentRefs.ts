// Referencias del catálogo que hacen falta para mostrar el equipo inicial: las de las opciones y, de los paquetes
// ya cargados, las de su contenido. Quien llama repite hasta que no aparezcan referencias nuevas.
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import type { ChoiceKind, ItemData, Pack, Ref } from "@/lib/rules/types";

export const refKey = (ref: Ref) => `${ref.book}:${ref.key}`;

/** Nombre de la clave sin tipo ni fuente: "item:longsword|xphb" → "longsword". */
export const bareName = (key: string) => key.replace(/^[^:]*:/, "").split("|")[0];

/** Si `v` tiene la forma de una referencia `{ book, key }`. */
export const isRef = (v: unknown): v is Ref =>
  typeof v === "object" && v !== null && typeof (v as Ref).book === "string" && typeof (v as Ref).key === "string";

/** Si un objeto del catálogo vale para una elección de equipo (`Pack.choose`). */
export function choiceMatches(kind: ChoiceKind, data: ItemData): boolean {
  switch (kind) {
    case "gaming": return data.type === "GS";
    case "instrument": return data.type === "INS";
    case "artisan": return data.type === "AT";
    case "simple": case "martial": return data.weapon?.category === kind;
    case "simpleMelee": return data.weapon?.category === "simple" && data.type === "M";
    case "martialMelee": return data.weapon?.category === "martial" && data.type === "M";
  }
}

/** Los `Pack` con el objeto elegido en lugar del texto de los que tienen `choose` (clave del pick = índice en texto). */
export function applyPicks(packs: Pack[], picks?: Record<string, Ref>): Pack[] {
  if (!picks) return packs;
  return packs.map((p, i) => {
    const pick = p.choose ? picks[String(i)] : undefined;
    return pick ? { ref: pick, quantity: p.quantity } : p;
  });
}

export function equipmentRefs(options: Pack[][], lookup: (key: string) => CatalogEntry | null | undefined): Ref[] {
  const found = new Map<string, Ref>();
  const visit = (ref: Ref) => {
    const k = refKey(ref);
    if (found.has(k)) return;
    found.set(k, ref);
    const contents = (lookup(k)?.data as ItemData | undefined)?.contents;
    for (const c of contents ?? []) visit(c.ref);
  };
  for (const packs of options) for (const p of packs) if (p.ref) visit(p.ref);
  return [...found.values()];
}

/** Carga en `entries` los objetos de las opciones de equipo y, por tandas, el contenido de los paquetes. */
export async function loadEquipmentEntries(
  options: Pack[][],
  entries: Map<string, CatalogEntry>,
  resolve: (ref: Ref) => Promise<CatalogEntry | null>,
  picks: Ref[] = [],
): Promise<void> {
  const tried = new Set<string>();
  // Un paquete dentro de otro es raro: con unas pocas tandas basta
  for (let i = 0; i < 4; i++) {
    const pending = equipmentRefs([...options, picks.map((ref) => ({ ref }))], (k) => entries.get(k))
      .filter((r) => !tried.has(refKey(r)) && !entries.has(refKey(r)));
    if (pending.length === 0) return;
    pending.forEach((r) => tried.add(refKey(r)));
    const found = await Promise.all(pending.map(resolve));
    found.forEach((e, j) => e && entries.set(refKey(pending[j]), e));
  }
}
