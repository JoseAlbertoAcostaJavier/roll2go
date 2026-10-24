// Rehacer la creación de un personaje de nivel 1: el borrador con el que se precarga el creador y lo que se sustituye
// en la hoja al guardar.
import type { Ref } from "@/lib/rules/types";
import { refKey } from "./equipmentRefs";
import type { Choice, Dnd2024SheetV2 } from "./sheet";
import { preparedKey } from "./spellcasting";
import { emptySpellPick, type SpellPick } from "./spellPicks";

/** Borrador del creador (mismo formato que el que guarda en localStorage; el creador lo vuelve a comprobar). */
export type CreationDraft = {
  name: string;
  pronouns: string[];
  status: string;
  species: Ref;
  lineage: Ref | null;
  speciesSkills: string[];
  size: "S" | "M" | "L" | null;
  background: Ref;
  bonus: Dnd2024SheetV2["background"]["abilities"];
  bgEquipment: string;
  klass: Ref | null;
  /** Elecciones de nivel 1 por `source`: habilidades o claves `libro:clave` de las entradas. */
  classChoices: Record<string, string[]>;
  classEquipment: string;
  /** Trucos y conjuros iniciales (o libro) y preparados iniciales (claves `libro:clave`). */
  spells: SpellPick;
  prepared: string[];
  method: Dnd2024SheetV2["abilityMethod"];
  base: Dnd2024SheetV2["baseAbilities"];
  rolls: Dnd2024SheetV2["rolls"];
  alignment: string;
  appearance: string;
  age: string;
  backstory: string;
  languages: string;
  notes: string;
  xp: string;
};

// Lo elegido en una elección, como lo guarda el creador (la subclase no se elige en él; los conjuros van aparte)
function choiceValues(c: Choice): string[] | null {
  switch (c.type) {
    case "skills":
    case "expertise":
      return c.value;
    case "weaponMastery":
      return c.value.map(refKey);
    case "featureOption":
      return [refKey(c.value.ref)];
    case "feat":
    case "optionalFeature":
      return c.value.map((v) => refKey(v.ref));
    default:
      return null;
  }
}

/** Borrador del creador con la creación actual del personaje (su nivel 1). */
export function creationDraft(
  character: { name: string; pronouns: string[]; status: string; backstory: string },
  sheet: Dnd2024SheetV2,
): CreationDraft {
  const first = sheet.levels[0];
  const classChoices: Record<string, string[]> = {};
  for (const c of first?.choices ?? []) {
    const v = choiceValues(c);
    if (v) classChoices[c.source] = v;
  }
  const spellChoice = first?.choices.find((c) => c.type === "spells");
  const spells = emptySpellPick();
  if (spellChoice?.type === "spells") {
    spells.cantrips = spellChoice.value.cantrips.map((c) => refKey(c.ref));
    spells.spells = spellChoice.value.spells.map((c) => refKey(c.ref));
  }
  const prepared = first ? (sheet.prepared[preparedKey(first.class.ref)] ?? []).map(refKey) : [];
  return {
    name: character.name,
    pronouns: character.pronouns,
    status: character.status,
    species: sheet.species.ref,
    lineage: sheet.lineage?.ref ?? null,
    speciesSkills: sheet.speciesChoices.skills,
    size: sheet.speciesChoices.size,
    background: sheet.background.ref,
    bonus: sheet.background.abilities,
    bgEquipment: sheet.background.equipment,
    klass: first?.class.ref ?? null,
    classChoices,
    classEquipment: first?.equipment ?? "",
    spells,
    prepared,
    method: sheet.abilityMethod,
    base: sheet.baseAbilities,
    rolls: sheet.rolls,
    alignment: sheet.alignment,
    appearance: sheet.appearance,
    age: sheet.age,
    backstory: character.backstory,
    languages: sheet.languages,
    notes: sheet.notes,
    xp: String(sheet.xp),
  };
}

/**
 * `$set` que sustituye la creación por la de `next` (la hoja validada): especie, trasfondo, características, el nivel
 * 1, el inventario inicial y los PG. Los conjuros preparados y los espacios gastados dependían de la clase, así que
 * también vuelven a empezar. Los textos y la experiencia no se tocan (se editan en «Editar personaje»).
 */
export function creationUpdate(next: Dnd2024SheetV2): Record<string, unknown> {
  const keys = [
    "species", "lineage", "background", "abilityMethod", "baseAbilities", "rolls", "speciesChoices", "hp",
    "levels", "classesSummary", "inventory", "weaponMasteries", "prepared", "spellbookExtra", "slotsUsed",
  ] as const;
  return Object.fromEntries(keys.map((k) => [`sheet.${k}`, next[k]]));
}
