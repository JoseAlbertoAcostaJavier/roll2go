// Libros que usa de verdad una hoja: los de todas sus referencias al catálogo. Sirve para comprobar si un personaje
// cabe en una campaña que limita los libros (Character.books es solo el filtro del creador y puede estar vacío).
import type { Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet";
import { isRef } from "@/lib/rules/dnd2024/equipmentRefs";

/** Ids distintos de los libros de la especie, legado, trasfondo, niveles (clases y elecciones), inventario y conjuros. */
export function booksUsedBy(sheet: Dnd2024SheetV2): string[] {
  const books = new Set<string>();
  // Recorre objetos y listas hasta dar con referencias
  const visit = (v: unknown) => {
    if (isRef(v)) books.add(v.book);
    else if (Array.isArray(v)) v.forEach(visit);
    else if (typeof v === "object" && v !== null) Object.values(v).forEach(visit);
  };
  visit([
    sheet.species,
    sheet.lineage,
    sheet.background,
    sheet.levels,
    sheet.inventory?.items?.map((i) => i.ref),
    sheet.prepared,
    sheet.spellbookExtra,
    sheet.weaponMasteries,
  ]);
  return [...books];
}
