// Referencias del catálogo que hacen falta para mostrar el equipo inicial: las de las opciones y, de los paquetes
// ya cargados, las de su contenido. Quien llama repite hasta que no aparezcan referencias nuevas.
import type { CatalogEntry } from "@/lib/rules/catalog";
import type { ItemData, Pack, Ref } from "@/lib/rules/types";

export const refKey = (ref: Ref) => `${ref.book}:${ref.key}`;

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
