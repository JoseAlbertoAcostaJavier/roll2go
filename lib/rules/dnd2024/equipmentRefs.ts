// Referencias del catálogo que hacen falta para mostrar el equipo inicial: las de las opciones y, de los paquetes
// ya cargados, las de su contenido. Quien llama repite hasta que no aparezcan referencias nuevas.
import type { CatalogEntry } from "@/lib/rules/catalog";
import type { ItemData, Pack, Ref } from "@/lib/rules/types";

export const refKey = (ref: Ref) => `${ref.book}:${ref.key}`;

/** Nombre de la clave sin tipo ni fuente: "item:longsword|xphb" → "longsword". */
export const bareName = (key: string) => key.replace(/^[^:]*:/, "").split("|")[0];

/** Si `v` tiene la forma de una referencia `{ book, key }`. */
export const isRef = (v: unknown): v is Ref =>
  typeof v === "object" && v !== null && typeof (v as Ref).book === "string" && typeof (v as Ref).key === "string";

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
): Promise<void> {
  const tried = new Set<string>();
  // Un paquete dentro de otro es raro: con unas pocas tandas basta
  for (let i = 0; i < 4; i++) {
    const pending = equipmentRefs(options, (k) => entries.get(k))
      .filter((r) => !tried.has(refKey(r)) && !entries.has(refKey(r)));
    if (pending.length === 0) return;
    pending.forEach((r) => tried.add(refKey(r)));
    const found = await Promise.all(pending.map(resolve));
    found.forEach((e, j) => e && entries.set(refKey(pending[j]), e));
  }
}
