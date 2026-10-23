// Conversión de la hoja v1 (una clase con sus elecciones) a la v2 (historial de niveles e inventario). Función pura:
// la usan la creación, la migración (`npm run migrate:levels`) y las páginas que aún abren personajes v1.
import type { CatalogEntry } from "@/lib/rules/catalog";
import type { BackgroundData, ClassData } from "@/lib/rules/types";
import { refKey } from "./equipmentRefs";
import { startingInventory } from "./inventory";
import type { AnySheet, Choice, Dnd2024Sheet, Dnd2024SheetV2, LevelEntry } from "./sheet";

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

const isSkills = (c: Choice): c is Extract<Choice, { type: "skills" }> => c.type === "skills";

/** Vista v1 de cualquier hoja, para el cálculo actual (`derive`) hasta que pase a leer la v2. */
export function toV1View(sheet: AnySheet): Dnd2024Sheet {
  if (sheet.version === 1) return sheet;
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const {
    version: _version, levels, classesSummary, inventory: _inventory, prepared: _prepared,
    spellbookExtra: _spellbookExtra, slotsUsed: _slotsUsed, ...rest
  } = sheet;
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const first = levels[0];
  const skills = first?.choices.find(isSkills)?.value ?? [];
  return {
    ...rest,
    version: 1,
    // Las elecciones de nivel 1 (habilidades y equipo) son de la primera clase
    classes: classesSummary.map((s, i) => ({
      ...s.class,
      level: s.level,
      subclass: s.subclass,
      skills: i === 0 ? skills : [],
      equipment: i === 0 ? (first?.equipment ?? "") : "",
    })),
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
