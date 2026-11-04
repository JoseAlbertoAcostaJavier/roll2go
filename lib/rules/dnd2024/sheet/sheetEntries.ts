// Entradas del catálogo que necesita la ficha: especie, legado, trasfondo y su dote de origen, clases y subclases
// con sus rasgos hasta el nivel actual, dotes y rasgos opcionales elegidos, opciones de rasgo elegidas y objetos del
// inventario (y, en una hoja v1, el equipo inicial elegido con el contenido de los paquetes). Puro: quien llama
// inyecta la consulta en lote al catálogo.
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import { fixedLanguageRefs } from "@/lib/rules/dnd2024/creation/languages";
import { bareName, equipmentRefs, refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import { heldOptionalFeatures } from "@/lib/rules/dnd2024/levels/held";
import type { AnySheet } from "@/lib/rules/dnd2024/sheet/sheet";
import { summarizeClasses } from "@/lib/rules/dnd2024/sheet/upgrade";
import type { BackgroundData, ClassData, LevelFeature, Ref, SubclassData } from "@/lib/rules/types";

/** Busca varias referencias de una vez; las que no existen no aparecen en el resultado. */
export type FetchEntries = (refs: Ref[]) => Promise<CatalogEntry[]>;

// Cada tanda descubre referencias nuevas (rasgos de la clase cargada, contenido de un paquete…); con pocas basta
const MAX_ROUNDS = 6;

// Referencias que hacen falta con lo que ya está cargado
function wantedRefs(sheet: AnySheet, entries: Map<string, CatalogEntry>): Ref[] {
  const data = <T,>(ref: Ref | undefined | null) => (ref ? (entries.get(refKey(ref))?.data as T | undefined) : undefined);
  const classes = sheet.version === 2
    ? summarizeClasses(sheet.levels).map((c) => ({ ref: c.class.ref, level: c.level, subclass: c.subclass?.ref ?? null }))
    : sheet.classes.map((c) => ({ ref: c.ref, level: c.level, subclass: c.subclass?.ref ?? null }));
  const upTo = (list: LevelFeature[] | undefined, level: number) =>
    (list ?? []).filter((f) => f.level <= level).map((f) => f.ref);

  const feats = sheet.version === 2
    ? sheet.levels.flatMap((l) => l.choices.flatMap((c) =>
      c.type === "feat" ? c.value.map((f) => f.ref) : c.type === "asi" && "feat" in c.value ? [c.value.feat.ref] : []))
    : [];
  // Las opciones escritas a mano (libro `builtin`) no están en el catálogo y no se piden
  const options = sheet.version === 2
    ? [
      ...heldOptionalFeatures(sheet.levels).map((o) => o.ref),
      ...sheet.levels.flatMap((l) => l.choices.flatMap((c) => (c.type === "featureOption" ? [c.value.ref] : []))),
    ]
    : [];
  const inventory = sheet.version === 2 ? sheet.inventory.items.flatMap((i) => (i.ref ? [i.ref] : [])) : [];
  const bg = data<BackgroundData>(sheet.background.ref);

  const refs: Ref[] = [
    sheet.species.ref,
    ...(sheet.lineage ? [sheet.lineage.ref] : []),
    sheet.background.ref,
    ...(bg?.feat ? [bg.feat] : []),
    ...classes.flatMap((c) => [
      c.ref,
      ...upTo(data<ClassData>(c.ref)?.features, c.level),
      ...(c.subclass ? [c.subclass, ...upTo(data<SubclassData>(c.subclass)?.features, c.level)] : []),
    ]),
    ...feats,
    ...options,
    ...inventory,
    ...fixedLanguageRefs(
      Object.fromEntries(classes.map((c) => [bareName(c.ref.key), c.level])), sheet.species.ref.book),
    ...(sheet.languageChoices ?? []),
  ];

  // Una hoja v1 necesita el equipo inicial elegido (y el contenido de los paquetes) para convertirla en v2
  if (sheet.version === 1) {
    const first = sheet.classes[0];
    const options = [
      data<ClassData>(first?.ref)?.equipment?.[first?.equipment ?? ""] ?? [],
      bg?.equipment?.[sheet.background.equipment] ?? [],
    ];
    refs.push(...equipmentRefs(options, (k) => entries.get(k)));
  }
  return refs;
}

/** Carga por tandas las entradas de la hoja que están en `books`; las que no existen quedan fuera del mapa. */
export async function loadSheetEntries(
  sheet: AnySheet, books: string[], fetchEntries: FetchEntries,
): Promise<Map<string, CatalogEntry>> {
  const entries = new Map<string, CatalogEntry>();
  const tried = new Set<string>();
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const pending = new Map<string, Ref>();
    for (const r of wantedRefs(sheet, entries)) {
      const k = refKey(r);
      if (!tried.has(k) && !pending.has(k)) pending.set(k, r);
    }
    if (pending.size === 0) break;
    pending.forEach((_, k) => tried.add(k));
    const allowed = [...pending.values()].filter((r) => books.includes(r.book));
    if (allowed.length === 0) continue;
    for (const e of await fetchEntries(allowed)) entries.set(refKey(e.ref), e);
  }
  return entries;
}
