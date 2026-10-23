// Conversión de la hoja v1 (una clase con sus elecciones) a la v2 (historial de niveles e inventario). Función pura:
// la usan la creación, la migración (`npm run migrate:levels`) y las páginas que aún abren personajes v1.
import type { CatalogEntry } from "@/lib/rules/catalog";
import type { BackgroundData, ClassData, Ref } from "@/lib/rules/types";
import { loadEquipmentEntries, refKey } from "./equipmentRefs";
import { startingInventory } from "./inventory";
import type { AnySheet, Dnd2024Sheet, Dnd2024SheetV2, LevelEntry, Named } from "./sheet";

const SKILLS_SOURCE = "class:skills";
const SUBCLASS_SOURCE = "class:subclass";

/** Clases, niveles y subclases que resultan del historial, en orden de aparición. */
export function summarizeClasses(levels: LevelEntry[]): Dnd2024SheetV2["classesSummary"] {
  const summary = new Map<string, Dnd2024SheetV2["classesSummary"][number]>();
  for (const l of levels) {
    const key = refKey(l.class.ref);
    const row = summary.get(key) ?? { class: l.class, level: 0, subclass: null };
    row.level = l.classLevel;
    for (const c of l.choices) if (c.type === "subclass") row.subclass = c.value;
    summary.set(key, row);
  }
  return [...summary.values()];
}

/**
 * Entradas que necesita upgradeSheet para guardar la conversión: la clase, el trasfondo y los objetos del equipo
 * elegido (con el contenido de los paquetes), sin filtrar por libros. Las que ya no existen quedan fuera.
 */
export async function loadUpgradeEntries(
  sheet: Dnd2024Sheet,
  resolve: (ref: Ref) => Promise<CatalogEntry | null>,
): Promise<Map<string, CatalogEntry>> {
  const entries = new Map<string, CatalogEntry>();
  const cls = sheet.classes?.[0];
  const refs = [cls?.ref, sheet.background?.ref].filter((r): r is Ref => !!r);
  for (const r of refs) {
    const e = await resolve(r);
    if (e) entries.set(refKey(r), e);
  }
  const klass = cls ? (entries.get(refKey(cls.ref))?.data as ClassData | undefined) : undefined;
  const bg = entries.get(refKey(sheet.background.ref))?.data as BackgroundData | undefined;
  const options = [klass?.equipment?.[cls?.equipment ?? ""] ?? [], bg?.equipment?.[sheet.background.equipment] ?? []];
  await loadEquipmentEntries(options, entries, resolve);
  return entries;
}

/**
 * Nombres guardados de la clase y el trasfondo de una hoja v1 que no están en `entries`. Si falta alguno, la
 * conversión no se guarda: quedaría con 0 PG o sin el equipo inicial en el inventario.
 */
export function missingForUpgrade(sheet: Dnd2024Sheet, entries: Map<string, CatalogEntry>): string[] {
  const named: Named[] = [sheet.classes?.[0], sheet.background].filter((n) => !!n);
  return named.filter((n) => !entries.has(refKey(n.ref))).map((n) => n.name);
}

/** Convierte una hoja v1 en v2; una v2 se devuelve tal cual. `entries` debe tener la clase, el trasfondo y su equipo. */
export function upgradeSheet(
  sheet: AnySheet,
  entries: Map<string, CatalogEntry>,
  makeId: () => string,
): Dnd2024SheetV2 {
  if (sheet.version === 2) return sheet;
  const { version: _version, classes, ...rest } = sheet; // eslint-disable-line @typescript-eslint/no-unused-vars

  const first = classes[0];
  const classData = first ? (entries.get(refKey(first.ref))?.data as ClassData | undefined) : undefined;
  const bgData = entries.get(refKey(sheet.background.ref))?.data as BackgroundData | undefined;
  const levels: LevelEntry[] = first
    ? [{
        n: 1,
        class: { ref: first.ref, name: first.name },
        classLevel: 1,
        hp: { method: "max", value: classData?.hitDie ?? 0 },
        choices: [
          { type: "skills", source: SKILLS_SOURCE, value: first.skills },
          ...(first.subclass ? [{ type: "subclass" as const, source: SUBCLASS_SOURCE, value: first.subclass }] : []),
        ],
        equipment: first.equipment,
      }]
    : [];

  return {
    ...rest,
    version: 2,
    levels,
    classesSummary: summarizeClasses(levels),
    inventory: startingInventory(
      [
        { pack: classData?.equipment?.[first?.equipment ?? ""] ?? [] },
        { pack: bgData?.equipment?.[sheet.background.equipment] ?? [] },
      ],
      entries,
      makeId,
    ),
    prepared: {},
    spellbookExtra: [],
    slotsUsed: {},
  };
}

/** Clases de una hoja v1 o v2 para los listados (basta con haber cargado `classes` o `classesSummary`). */
export function classesOf(sheet: {
  classes?: Dnd2024Sheet["classes"];
  classesSummary?: Dnd2024SheetV2["classesSummary"];
}): Dnd2024SheetV2["classesSummary"] {
  if (sheet.classesSummary) return sheet.classesSummary;
  return (sheet.classes ?? []).map((c) => ({ class: { ref: c.ref, name: c.name }, level: c.level, subclass: c.subclass }));
}
