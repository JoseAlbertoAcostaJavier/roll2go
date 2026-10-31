// Conjuros de dote al crear el personaje (nivel 1), aparte de las demás elecciones de la clase: los de la dote del
// trasfondo y los de las invocaciones elegidas en el nivel 1 (Pacto del tomo). Parte de `validateSheet`.
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import type { FeatData, OptionalFeatureData, Ref } from "@/lib/rules/types";
import { refKey } from "../sheet/equipmentRefs";
import type { Choice } from "../sheet/sheet";
import {
  checkFeatSpellChoices, featSpellClash, featSpellPending, featSpellsSource, type FeatWithData,
} from "../spells/featSpells";

/**
 * Comprueba los conjuros de dote elegidos al crear (`raw`: las elecciones `featSpells` del nivel 1) para la dote del
 * trasfondo (`bgFeatRef`, con sus datos `bgFeat`) y las invocaciones de `checked` (las demás elecciones del nivel 1,
 * ya comprobadas, con sus entradas en `classEntries`). El mismo conjuro no se elige a la vez con la dote y para la clase.
 */
export async function checkFeatSpells(
  raw: unknown[], bgFeatRef: Ref | undefined, bgFeat: FeatData | undefined, checked: Choice[],
  classEntries: Map<string, CatalogEntry>, ctx: { books: string[]; resolve: (ref: Ref) => Promise<CatalogEntry | null> },
): Promise<{ choices: Choice[]; errors: Record<string, string> }> {
  const featEntry = bgFeat && bgFeatRef ? await ctx.resolve(bgFeatRef) : null;
  const withSpells: FeatWithData[] = [
    ...(featEntry ? [{ ref: featEntry.ref, name: featEntry.nameEs || featEntry.name, data: bgFeat }] : []),
    ...checked.flatMap((c) => (c.type === "optionalFeature" ? c.value : [])).map((o) => ({
      ref: o.ref, name: o.name, data: classEntries.get(refKey(o.ref))?.data as OptionalFeatureData | undefined,
    })),
  ];
  const featSpells = await checkFeatSpellChoices(
    featSpellPending(withSpells, (l) => l <= 1),
    raw, { path: "levels.0.choices", books: ctx.books, resolve: ctx.resolve },
  );
  // El mismo conjuro no se elige a la vez con la dote y para la clase
  const clash = featSpellClash([...checked, ...featSpells.choices]);
  // (sin pisar un error anterior de esa elección: gana el primero, como en `err`)
  const clashKey = clash ? `levels.0.choices.${clash.source}` : "";
  if (clash && !(clashKey in featSpells.errors)) {
    const label = withSpells.find((f) => featSpellsSource(f.ref) === clash.source)?.name ?? "";
    featSpells.errors[clashKey] = `Conjuros de ${label}: ${clash.name} ya lo eliges con la clase.`;
  }
  return featSpells;
}
