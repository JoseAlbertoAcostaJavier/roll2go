// Conjuros de la ficha (spec de conjuros §2): un bloque por clase o subclase lanzadora con sus límites, los espacios
// (combinados en multiclase y la Magia de pacto aparte) y los conjuros de especie, legado y dotes.
import type { CatalogEntry } from "@/lib/rules/catalog";
import { refKey } from "@/lib/rules/dnd2024/equipmentRefs";
import type { Dnd2024SheetV2, Named, SpellChoice } from "@/lib/rules/dnd2024/sheet";
import { maxSpellLevel, PACT_SLOTS, preparedKey, slotLevels } from "@/lib/rules/dnd2024/spellcasting";
import { summarizeClasses } from "@/lib/rules/dnd2024/upgrade";
import type {
  Ability, BackgroundData, ClassData, FeatData, LineageData, Ref, SpeciesData, Spellcasting, SpellcastingMode,
  SpellcastingProgression, SubclassData,
} from "@/lib/rules/types";
import type { AbilityScores } from "./abilities";
import { characterFeats } from "./features";

export type OtherSpell = { spell: Named; origin: string };

export type CasterBlock = {
  /** Clase o, en las subclases lanzadoras (Caballero arcano…), la subclase. */
  class: Ref;
  name: string;
  ability: Ability;
  mode: SpellcastingMode;
  dc: number;
  attack: number;
  cantripLimit: number;
  preparedLimit: number;
  maxSpellLevel: number;
  /** Aprendidos (modo `levelUp`). */
  known: Named[];
  cantrips: Named[];
  /** Preparados que cuentan para el límite (en modo `levelUp`, los aprendidos). */
  prepared: Ref[];
  /** Libro de conjuros (modo `spellbook`): entradas de los niveles y copiados. */
  spellbook: Named[];
  /** Siempre preparados de la clase y de la subclase; no cuentan para el límite. */
  always: OtherSpell[];
};

export type Slots = { levels: Record<string, number>; pact: { count: number; level: number } | null };

export type SpellsSummary = { blocks: CasterBlock[]; slots: Slots; other: OtherSpell[]; used: Record<string, number> };

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
// "spell:detect magic|xphb" → "Detect magic"
const nameFromKey = (key: string) => capitalize(key.replace(/^[^:]*:/, "").split("|")[0]);

const named = (ref: Ref, entries: Map<string, CatalogEntry>): Named => {
  const e = entries.get(refKey(ref));
  return { ref, name: e ? (e.nameEs ?? e.name) : nameFromKey(ref.key) };
};

type Granted = { level: number; ref: Ref }[] | undefined;
// Conjuros concedidos hasta un nivel
const upTo = (list: Granted, max: number) => (list ?? []).filter((s) => s.level <= max).map((s) => s.ref);

// Fuentes de lanzamiento: cada clase con lanzamiento y, si no lo tiene, su subclase lanzadora
type Caster = {
  ref: Ref; name: string; level: number; casting: Spellcasting;
  progressions: Partial<Pick<ClassData["progressions"], "cantrips" | "prepared">>;
  /** La clase (aunque lance su subclase), para sus conjuros siempre preparados. */
  klass: { named: Named; data: ClassData | undefined };
  subclass: { named: Named; data: SubclassData | undefined } | null;
};

function casters(sheet: Dnd2024SheetV2, entries: Map<string, CatalogEntry>): Caster[] {
  const out: Caster[] = [];
  for (const c of summarizeClasses(sheet.levels)) {
    const data = entries.get(refKey(c.class.ref))?.data as ClassData | undefined;
    const sub = c.subclass ? (entries.get(refKey(c.subclass.ref))?.data as SubclassData | undefined) : undefined;
    const subclass = c.subclass ? { named: c.subclass, data: sub } : null;
    const klass = { named: c.class, data };
    if (data?.spellcasting) {
      out.push({
        ref: c.class.ref, name: c.class.name, level: c.level, casting: data.spellcasting, progressions: data.progressions,
        klass, subclass,
      });
    } else if (c.subclass && sub?.spellcasting) {
      out.push({
        ref: c.subclass.ref, name: c.subclass.name, level: c.level, casting: sub.spellcasting, progressions: sub.progressions,
        klass, subclass,
      });
    }
  }
  return out;
}

// Trucos y conjuros elegidos para una clase en el historial, con las sustituciones aplicadas en orden
function chosenSpells(sheet: Dnd2024SheetV2, cls: Ref) {
  const cantrips: Named[] = [];
  const spells: Named[] = [];
  for (const l of sheet.levels) {
    for (const c of l.choices) {
      if (c.type !== "spells" || refKey(c.value.class) !== refKey(cls)) continue;
      const v: SpellChoice = c.value;
      cantrips.push(...v.cantrips);
      spells.push(...v.spells);
      if (v.replace) {
        const out = refKey(v.replace.out.ref);
        const list = cantrips.some((s) => refKey(s.ref) === out) ? cantrips : spells;
        const i = list.findIndex((s) => refKey(s.ref) === out);
        if (i >= 0) list.splice(i, 1);
        list.push(v.replace.in);
      }
    }
  }
  return { cantrips, spells };
}

/** Un bloque por clase o subclase lanzadora, en el orden del historial. */
export function casterBlocks(
  sheet: Dnd2024SheetV2,
  derived: { abilities: AbilityScores; proficiencyBonus: number },
  entries: Map<string, CatalogEntry>,
): CasterBlock[] {
  return casters(sheet, entries).map((c) => {
    const { mode, ability, progression } = c.casting;
    const mod = derived.abilities[ability].mod;
    const { cantrips, spells } = chosenSpells(sheet, c.ref);
    const known = mode === "levelUp" ? spells : [];
    // Los de la clase y los de la subclase hasta el nivel de clase
    const always = [
      ...upTo(c.klass.data?.spells, c.level).map((r) => ({ spell: named(r, entries), origin: c.klass.named.name })),
      ...(c.subclass ? upTo(c.subclass.data?.spells, c.level).map((r) => ({ spell: named(r, entries), origin: c.subclass!.named.name })) : []),
    ];
    return {
      class: c.ref,
      name: c.name,
      ability,
      mode,
      dc: 8 + derived.proficiencyBonus + mod,
      attack: derived.proficiencyBonus + mod,
      cantripLimit: c.progressions.cantrips?.[c.level - 1] ?? 0,
      preparedLimit: c.progressions.prepared?.[c.level - 1] ?? 0,
      maxSpellLevel: maxSpellLevel(progression, c.level),
      known,
      cantrips,
      prepared: mode === "levelUp" ? known.map((k) => k.ref) : (sheet.prepared[preparedKey(c.ref)] ?? []),
      spellbook: mode === "spellbook" ? [...spells, ...sheet.spellbookExtra] : [],
      always,
    };
  });
}

/** Espacios de conjuro: los normales (multiclase combinados) y la Magia de pacto aparte. */
export function spellSlots(sheet: Dnd2024SheetV2, entries: Map<string, CatalogEntry>): Slots {
  const sources: { progression: SpellcastingProgression; level: number }[] = casters(sheet, entries)
    .map((c) => ({ progression: c.casting.progression, level: c.level }));
  const pactLevel = sources.filter((s) => s.progression === "pact").reduce((a, s) => a + s.level, 0);
  return {
    levels: slotLevels(sources),
    pact: pactLevel > 0 ? PACT_SLOTS[Math.min(pactLevel, 20) - 1] : null,
  };
}

/**
 * Conjuros que no son de una clase lanzadora: especie y legado (hasta el nivel total), dotes (los fijos, desde el
 * nivel total que piden) y clases y subclases que no lanzan (Guerrero psiónico…), con su origen.
 */
export function otherSpells(sheet: Dnd2024SheetV2, entries: Map<string, CatalogEntry>): OtherSpell[] {
  const level = sheet.levels.length;
  const out: OtherSpell[] = [];
  const add = (refs: Ref[], origin: string) => out.push(...refs.map((r) => ({ spell: named(r, entries), origin })));

  const species = entries.get(refKey(sheet.species.ref))?.data as SpeciesData | undefined;
  add(upTo(species?.spells, level), `Especie: ${sheet.species.name}`);
  if (sheet.lineage) {
    const lineage = entries.get(refKey(sheet.lineage.ref))?.data as LineageData | undefined;
    add(upTo(lineage?.spells, level), `Legado: ${sheet.lineage.name}`);
  }
  const casterRefs = new Set(casters(sheet, entries).map((c) => refKey(c.ref)));
  for (const c of summarizeClasses(sheet.levels)) {
    if (casterRefs.has(refKey(c.class.ref)) || (c.subclass && casterRefs.has(refKey(c.subclass.ref)))) continue;
    add(upTo((entries.get(refKey(c.class.ref))?.data as ClassData | undefined)?.spells, c.level), c.class.name);
    if (!c.subclass) continue;
    const sub = entries.get(refKey(c.subclass.ref))?.data as SubclassData | undefined;
    add(upTo(sub?.spells, c.level), c.subclass.name);
  }
  for (const f of characterFeats(sheet, background(sheet, entries))) {
    add(upTo(featData(f.ref, entries)?.spells, level), `Dote: ${f.name ?? named(f.ref, entries).name}`);
  }
  return out;
}

const featData = (ref: Ref, entries: Map<string, CatalogEntry>) =>
  entries.get(refKey(ref))?.data as FeatData | undefined;

const background = (sheet: Dnd2024SheetV2, entries: Map<string, CatalogEntry>) =>
  entries.get(refKey(sheet.background.ref))?.data as BackgroundData | undefined;

/**
 * Bloques, espacios, otros conjuros y espacios gastados. `hasSpells`: si la ficha muestra la pestaña Conjuros
 * (también con una dote de conjuros elegidos, aunque aún no se guarden: `FeatData.grantsSpells`).
 */
export function spellsSummary(
  sheet: Dnd2024SheetV2,
  derived: { abilities: AbilityScores; proficiencyBonus: number },
  entries: Map<string, CatalogEntry>,
): { spells: SpellsSummary; hasSpells: boolean } {
  const blocks = casterBlocks(sheet, derived, entries);
  const other = otherSpells(sheet, entries);
  const spellFeat = characterFeats(sheet, background(sheet, entries)).some((f) => featData(f.ref, entries)?.grantsSpells);
  return {
    spells: { blocks, slots: spellSlots(sheet, entries), other, used: sheet.slotsUsed ?? {} },
    hasSpells: blocks.length > 0 || other.length > 0 || spellFeat,
  };
}
