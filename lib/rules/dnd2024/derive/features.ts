// Rasgos de la ficha agrupados por origen: especie, legado, cada clase con su subclase, los rasgos opcionales elegidos
// (maniobras, invocaciones, metamagia) y las dotes.
import type { CatalogEntry } from "@/lib/rules/catalog";
import { refKey } from "@/lib/rules/dnd2024/equipmentRefs";
import { FEATURE_OPTION_LABELS } from "@/lib/rules/dnd2024/featureChoices";
import { optionalFeatureLabel } from "@/lib/rules/dnd2024/labels";
import { heldOptionalFeatures } from "@/lib/rules/dnd2024/levels";
import type { Dnd2024SheetV2, Named } from "@/lib/rules/dnd2024/sheet";
import type { ClassData, LevelFeature, Ref, SubclassData } from "@/lib/rules/types";

export type FeatureGroup = {
  title: string;
  /** `option`: rasgos opcionales elegidos de una progresión (un grupo por progresión: «Maniobras»…). */
  source: "species" | "lineage" | "class" | "subclass" | "option" | "feat";
  ref: Ref | null;
  /** Nivel en la clase (bloques de clase y subclase). */
  level?: number;
  /**
   * `value`: valor actual de la tabla de clase (usos de Furia, dado de Artes marciales…); `chosen`: opciones elegidas
   * del rasgo (Orden divina, Presa del cazador…).
   */
  features: { ref: Ref; name: string; level: number; value?: string; chosen?: string[] }[];
};

/** Dote del personaje con el nivel total en que se obtuvo. */
export type FeatPick = { ref: Ref; name: string | null; level: number };

// Columna de la tabla de clase (etiqueta en español del importador) con el valor de cada rasgo, por su nombre en la
// clave del rasgo
export const FEATURE_COLUMNS: Record<string, string> = {
  rage: "Furias",
  "bardic inspiration": "Dado de inspiración bárdica",
  "channel divinity": "Canalizar divinidad",
  "wild shape": "Forma salvaje",
  "second wind": "Nuevas energías",
  "weapon mastery": "Maestría con armas",
  "martial arts": "Artes marciales",
  "monk's focus": "Puntos de concentración",
  "unarmored movement": "Movimiento sin armadura",
  "favored enemy": "Enemigo predilecto",
  "sneak attack": "Ataque furtivo",
  "font of magic": "Puntos de hechicería",
  "eldritch invocations": "Invocaciones",
};
// Ataque adicional no se acumula entre clases ni subclases (spec de subir de nivel §4.2): solo se muestra el primero
const isExtraAttack = (ref: Ref) => ref.key.replace(/^[^:]*:/, "").startsWith("extra attack|");
// Celda vacía o «—» (0 en la tabla): sin valor
const EMPTY_CELL = new Set(["", "—"]);

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
// "classFeature:danger sense|barbarian|xphb|2" → "Danger sense"
const nameFromKey = (key: string) => capitalize(key.replace(/^[^:]*:/, "").split("|")[0]);

export function featureGroups(
  sheet: Dnd2024SheetV2,
  classes: { class: Named; level: number; subclass: Named | null }[],
  feats: FeatPick[],
  entries: Map<string, CatalogEntry>,
): FeatureGroup[] {
  const entryName = (ref: Ref, fallback: string | null) => {
    const e = entries.get(refKey(ref));
    return e ? (e.nameEs ?? e.name) : (fallback ?? nameFromKey(ref.key));
  };
  // Rasgos hasta el nivel actual en la clase, en el orden del catálogo
  const upTo = (list: LevelFeature[] | undefined, level: number) =>
    (list ?? []).filter((f) => f.level <= level).map((f) => ({ ref: f.ref, name: entryName(f.ref, null), level: f.level }));

  // Valor de la tabla de la clase para el rasgo en el nivel de clase actual
  const tableValue = (data: ClassData | undefined, ref: Ref, level: number) => {
    const label = FEATURE_COLUMNS[ref.key.replace(/^[^:]*:/, "").split("|")[0]];
    const cell = label ? data?.table?.columns.find((c) => c.label === label)?.values[level - 1] : undefined;
    return cell === undefined || EMPTY_CELL.has(cell) ? {} : { value: cell };
  };
  // Opciones elegidas de los rasgos, por la clave del rasgo; las escritas a mano no tienen entrada de catálogo
  const chosen = new Map<string, string[]>();
  for (const c of sheet.levels.flatMap((l) => l.choices)) {
    if (c.type !== "featureOption") continue;
    const name = c.value.ref.book === "builtin"
      ? (FEATURE_OPTION_LABELS[c.value.ref.key] ?? c.value.name)
      : entryName(c.value.ref, c.value.name);
    chosen.set(c.source, [...(chosen.get(c.source) ?? []), name]);
  }
  const withChosen = <T extends { ref: Ref }>(f: T) => (chosen.has(f.ref.key) ? { ...f, chosen: chosen.get(f.ref.key) } : f);

  let extraAttack = false;
  // Quita Ataque adicional si ya lo da un bloque anterior
  const withoutRepeatedExtraAttack = <T extends { ref: Ref }>(features: T[]) => {
    const out = features.filter((f) => !(isExtraAttack(f.ref) && extraAttack));
    if (out.some((f) => isExtraAttack(f.ref))) extraAttack = true;
    return out;
  };

  const groups: FeatureGroup[] = [];
  if (sheet.species) groups.push({ title: sheet.species.name, source: "species", ref: sheet.species.ref, features: [] });
  if (sheet.lineage) groups.push({ title: sheet.lineage.name, source: "lineage", ref: sheet.lineage.ref, features: [] });
  for (const c of classes) {
    const data = entries.get(refKey(c.class.ref))?.data as ClassData | undefined;
    const features = withoutRepeatedExtraAttack(upTo(data?.features, c.level))
      .map((f) => withChosen({ ...f, ...tableValue(data, f.ref, c.level) }));
    groups.push({ title: c.class.name, source: "class", ref: c.class.ref, level: c.level, features });
    if (!c.subclass) continue;
    const sub = entries.get(refKey(c.subclass.ref))?.data as SubclassData | undefined;
    groups.push({
      title: c.subclass.name, source: "subclass", ref: c.subclass.ref, level: c.level,
      features: withoutRepeatedExtraAttack(upTo(sub?.features, c.level)).map(withChosen),
    });
  }
  // Rasgos opcionales que conserva, un grupo por progresión
  // ("progression:maneuvers|battle master|fighter|xphb" → «Maniobras»)
  const optional = new Map<string, FeatureGroup>();
  for (const o of heldOptionalFeatures(sheet.levels)) {
    const title = capitalize(optionalFeatureLabel(o.source.replace(/^[^:]*:/, "").split("|")[0]));
    const group = optional.get(title) ?? { title, source: "option", ref: null, features: [] };
    group.features.push({ ref: o.ref, name: entryName(o.ref, o.name), level: o.level });
    optional.set(title, group);
  }
  for (const g of optional.values()) g.features.sort((a, b) => a.level - b.level);
  groups.push(...optional.values());
  if (feats.length > 0) {
    groups.push({
      title: "Dotes", source: "feat", ref: null,
      features: feats.map((f) => ({ ref: f.ref, name: entryName(f.ref, f.name), level: f.level })),
    });
  }
  return groups;
}
