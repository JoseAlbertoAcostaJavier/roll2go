// Rasgos de la ficha agrupados por origen: especie, legado, cada clase con su subclase y las dotes.
import type { CatalogEntry } from "@/lib/rules/catalog";
import { refKey } from "@/lib/rules/dnd2024/equipmentRefs";
import type { Dnd2024SheetV2, Named } from "@/lib/rules/dnd2024/sheet";
import type { ClassData, LevelFeature, Ref, SubclassData } from "@/lib/rules/types";

export type FeatureGroup = {
  title: string;
  source: "species" | "lineage" | "class" | "subclass" | "feat";
  ref: Ref | null;
  /** Nivel en la clase (bloques de clase y subclase). */
  level?: number;
  /** `value`: valor actual de la tabla de clase (llega con la tabla en la parte 4). */
  features: { ref: Ref; name: string; level: number; value?: string }[];
};

/** Dote del personaje con el nivel total en que se obtuvo. */
export type FeatPick = { ref: Ref; name: string | null; level: number };

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

  const groups: FeatureGroup[] = [];
  if (sheet.species) groups.push({ title: sheet.species.name, source: "species", ref: sheet.species.ref, features: [] });
  if (sheet.lineage) groups.push({ title: sheet.lineage.name, source: "lineage", ref: sheet.lineage.ref, features: [] });
  for (const c of classes) {
    const data = entries.get(refKey(c.class.ref))?.data as ClassData | undefined;
    groups.push({
      title: c.class.name, source: "class", ref: c.class.ref, level: c.level, features: upTo(data?.features, c.level),
    });
    if (!c.subclass) continue;
    const sub = entries.get(refKey(c.subclass.ref))?.data as SubclassData | undefined;
    groups.push({
      title: c.subclass.name, source: "subclass", ref: c.subclass.ref, level: c.level, features: upTo(sub?.features, c.level),
    });
  }
  if (feats.length > 0) {
    groups.push({
      title: "Dotes", source: "feat", ref: null,
      features: feats.map((f) => ({ ref: f.ref, name: entryName(f.ref, f.name), level: f.level })),
    });
  }
  return groups;
}
