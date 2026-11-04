// Rehacer la creación de un personaje de nivel 1: el borrador con el que se precarga el creador y lo que se sustituye
// en la hoja al guardar.
import type { Ability, Ref } from "@/lib/rules/types";
import { refKey } from "../sheet/equipmentRefs";
import type { Choice, Dnd2024SheetV2 } from "../sheet/sheet";
import { emptySpellPick, type SpellPick } from "../spells/spellPicks";

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
  /** Objeto elegido en cada `Pack` con `choose` de la opción de equipo (clave = índice del `Pack`, en texto). */
  bgEquipmentPicks: Record<string, Ref>;
  klass: Ref | null;
  /** Elecciones de nivel 1 por `source`: habilidades o claves `libro:clave` de las entradas. */
  classChoices: Record<string, string[]>;
  classEquipment: string;
  classEquipmentPicks: Record<string, Ref>;
  /** Trucos y conjuros iniciales (o libro), claves `libro:clave`. Los preparados no se eligen al crear. */
  spells: SpellPick;
  /**
   * Conjuros de la dote del trasfondo (Iniciado en la magia…) y de las invocaciones de nivel 1 (Pacto del tomo), con la
   * lista elegida, y su característica de lanzamiento, por `source` de la elección.
   */
  featSpells: Record<string, SpellPick>;
  featAbility: Record<string, Ability>;
  method: Dnd2024SheetV2["abilityMethod"];
  base: Dnd2024SheetV2["baseAbilities"];
  rolls: Dnd2024SheetV2["rolls"];
  alignment: string;
  appearance: string;
  age: string;
  backstory: string;
  languages: string;
  /** Idiomas elegidos, en el orden de los huecos (origen, Pícaro). */
  languageChoices: Ref[];
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
  const featSpells: Record<string, SpellPick> = {};
  const featAbility: Record<string, Ability> = {};
  for (const c of first?.choices ?? []) {
    if (c.type !== "featSpells") continue;
    featSpells[c.source] = {
      ...emptySpellPick(),
      cantrips: c.value.cantrips.map((x) => refKey(x.ref)),
      spells: c.value.spells.map((x) => refKey(x.ref)),
      ...(c.value.list ? { list: c.value.list } : {}),
    };
    if (c.value.ability) featAbility[c.source] = c.value.ability;
  }
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
    bgEquipmentPicks: sheet.background.equipmentPicks ?? {},
    klass: first?.class.ref ?? null,
    classChoices,
    classEquipment: first?.equipment ?? "",
    classEquipmentPicks: first?.equipmentPicks ?? {},
    spells,
    featSpells,
    featAbility,
    method: sheet.abilityMethod,
    base: sheet.baseAbilities,
    rolls: sheet.rolls,
    alignment: sheet.alignment,
    appearance: sheet.appearance,
    age: sheet.age,
    backstory: character.backstory,
    languages: sheet.languages,
    languageChoices: sheet.languageChoices ?? [],
    notes: sheet.notes,
    xp: String(sheet.xp),
  };
}

/**
 * `$set` que sustituye la creación por la de `next` (la hoja validada): especie, trasfondo, características, el nivel
 * 1, el inventario inicial, los idiomas elegidos y los PG. Los conjuros preparados, los espacios gastados y los dados de golpe gastados
 * dependían de la creación anterior, así que también vuelven a empezar. Los textos y la experiencia no se tocan (se
 * editan en «Editar personaje»).
 */
export function creationUpdate(next: Dnd2024SheetV2): Record<string, unknown> {
  const keys = [
    "species", "lineage", "background", "abilityMethod", "baseAbilities", "rolls", "speciesChoices", "languageChoices", "hp",
    "levels", "classesSummary", "inventory", "weaponMasteries", "prepared", "spellbookExtra", "slotsUsed", "hitDiceUsed",
  ] as const;
  return Object.fromEntries(keys.map((k) => [`sheet.${k}`, next[k]]));
}
