// Conjuros de la ficha (spec de conjuros §2): un bloque por clase o subclase lanzadora con sus límites, los espacios
// (combinados en multiclase y la Magia de pacto aparte) y los conjuros de especie, legado y dotes.
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import { refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import { chosenFeatAbility, chosenFeatSpells } from "@/lib/rules/dnd2024/spells/featSpells";
import {
  BONUS_SPELL_ORIGINS, IMPROVED_ILLUSIONS, IMPROVED_ILLUSIONS_CANTRIP, SIGNATURE_SPELLS, SPELL_MASTERY,
} from "@/lib/rules/dnd2024/levels/featureChoices";
import {
  chosenSpells, heldArcana, heldBonusCantrips, heldBonusSpells, heldOptionalFeatures,
} from "@/lib/rules/dnd2024/levels/held";
import { secretSpellLists } from "@/lib/rules/dnd2024/levels/spellPending";
import type { Dnd2024SheetV2, Named } from "@/lib/rules/dnd2024/sheet/sheet";
import { maxSpellLevel, PACT_SLOTS, preparedKey, slotLevels, spellListOf } from "@/lib/rules/dnd2024/spells/spellcasting";
import { summarizeClasses } from "@/lib/rules/dnd2024/sheet/upgrade";
import {
  ABILITIES, type Ability, type BackgroundData, type ClassData, type FeatData, type LineageData,
  type OptionalFeatureData, type Ref, type SpeciesData, type Spellcasting, type SpellcastingMode,
  type SpellcastingProgression, type SubclassData,
} from "@/lib/rules/types";
import type { AbilityScores } from "./abilities";
import { characterFeats } from "./features";

export { chosenSpells };

/**
 * `innate`: de especie, legado o dote; si es de nivel 1+, se lanza una vez sin espacio por descanso largo.
 * `ability`: con la que se lanza, si se sabe (la elegida con la dote o la de la concesión); sin ella, Inteligencia
 * (`DEFAULT_SPELL_ABILITY`).
 */
export type OtherSpell = { spell: Named; origin: string; innate?: true; ability?: Ability };

/** Lo que hace falta para el ataque y la CD de los conjuros de `other`: competencia y modificadores de característica. */
export type CastingStats = { proficiencyBonus: number; mods: Record<Ability, number> };

/** Característica de lanzamiento por defecto de los conjuros de especie, legado y dotes sin otra indicada. */
export const DEFAULT_SPELL_ABILITY: Ability = "int";

/**
 * Conjuro que se lanza sin espacio un número de veces por descanso largo (Arcano místico, Conjuros distintivos), con
 * sus usos gastados.
 */
export type LimitedSpell = { key: string; spell: Named; origin: string; max: number; used: number };

/** Clave de los usos de un arcano en `sheet.limitedUsed`. */
export const arcanumKey = (ref: Ref) => `arcanum:${refKey(ref)}`;
/** Clave de los usos de un conjuro distintivo en `sheet.limitedUsed`. */
export const signatureKey = (ref: Ref) => `signature:${refKey(ref)}`;
/** Clave del uso gratis de un conjuro de especie, legado o dote en `sheet.limitedUsed`. */
export const innateKey = (ref: Ref) => `innate:${refKey(ref)}`;

/** Origen de los conjuros de Dominio de conjuros. */
export const SPELL_MASTERY_ORIGIN = "Dominio de conjuros";

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
  /**
   * Si la subclase tiene conjuros alternativos (la tierra del Círculo de la Tierra): sus nombres, el elegido y los
   * conjuros de cada uno hasta el nivel de clase.
   */
  spellOptions?: { subclass: Ref; names: string[]; current: string | null; spells: Record<string, Ref[]> };
  /** Con Secretos mágicos: las listas de las que elige los conjuros (no los trucos), incluida la suya. */
  lists?: string[];
  /** Conjuros con usos por descanso largo (Arcano místico, Conjuros distintivos). */
  limited: LimitedSpell[];
  /**
   * Con Dominio de conjuros: el conjuro de nivel 1 y el de nivel 2 elegidos en la ficha (null si no hay o si ya no
   * está en el libro).
   */
  mastery?: { 1: Ref | null; 2: Ref | null };
  /**
   * Con Conjuros distintivos sin elegir (hojas de antes del rasgo, en el último nivel): se eligen borrando el nivel 20 y
   * subiéndolo de nuevo.
   */
  signatureMissing?: true;
};

export type Slots = { levels: Record<string, number>; pact: { count: number; level: number } | null };

export type SpellsSummary = {
  blocks: CasterBlock[]; slots: Slots; other: OtherSpell[]; used: Record<string, number>;
  /** Usos gastados por descanso (`sheet.limitedUsed`): los de `other` no tienen otra fuente. */
  limitedUsed: Record<string, number>;
  /** Competencia y modificadores para el ataque y la CD de `other` (sin él, esos conjuros no llevan tirada). */
  casting?: CastingStats;
};

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
// "spell:detect magic|xphb" → "Detect magic"
const nameFromKey = (key: string) => capitalize(key.replace(/^[^:]*:/, "").split("|")[0]);

const named = (ref: Ref, entries: Map<string, CatalogEntry>): Named => {
  const e = entries.get(refKey(ref));
  return { ref, name: e ? (e.nameEs ?? e.name) : nameFromKey(ref.key) };
};

// Si una clase o subclase tiene un rasgo hasta un nivel de clase
const hasFeature = (data: { features: { ref: Ref; level: number }[] } | undefined, key: string, level: number) =>
  !!data?.features.some((f) => f.ref.key === key && f.level <= level);

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
    // (con la alternativa elegida en la ficha, si la subclase las tiene)
    const options = c.subclass?.data?.spellOptions ?? [];
    const current = c.subclass && options.length ? (sheet.spellOption?.[preparedKey(c.subclass.named.ref)] ?? null) : null;
    const option = options.find((o) => o.name === current);
    // Conjuros de los rasgos que no cuentan para los límites (Descubrimientos mágicos…), por la elección que los da
    const bonus = heldBonusSpells(sheet.levels, c.klass.named.ref);
    // Arcanos y conjuros distintivos: un uso cada uno
    const limitedOf = (spell: Named, key: string, origin: string, max = 1): LimitedSpell =>
      ({ key, spell, origin, max, used: Math.min(sheet.limitedUsed?.[key] ?? 0, max) });
    const limited = [
      ...heldArcana(sheet.levels, c.klass.named.ref).map((s) => limitedOf(s, arcanumKey(s.ref), "Arcano místico")),
      ...(bonus.get(SIGNATURE_SPELLS) ?? [])
        .map((s) => limitedOf(s, signatureKey(s.ref), BONUS_SPELL_ORIGINS[SIGNATURE_SPELLS])),
    ];
    const spellbook = mode === "spellbook" ? [...spells, ...sheet.spellbookExtra] : [];
    // Dominio de conjuros: los elegidos en la ficha que siguen en el libro
    const hasMastery = mode === "spellbook" && hasFeature(c.klass.data, SPELL_MASTERY, c.level);
    const inBook = (r: Ref | undefined) => (r && spellbook.some((s) => refKey(s.ref) === refKey(r)) ? r : null);
    const mastery = hasMastery ? { 1: inBook(sheet.spellMastery?.[1]), 2: inBook(sheet.spellMastery?.[2]) } : null;
    // Ilusiones mejoradas: Ilusión menor (que la subclase también da en sus conjuros) con su origen, salvo que la
    // conozca como truco de la clase o haya elegido otro truco en su lugar
    const illusions = hasFeature(c.subclass?.data, IMPROVED_ILLUSIONS, c.level);
    const isIllusion = (r: Ref) => r.key === IMPROVED_ILLUSIONS_CANTRIP;
    const illusionRef = c.subclass?.data?.spells?.map((g) => g.ref).find(isIllusion)
      ?? (c.subclass ? { book: c.subclass.named.ref.book, key: IMPROVED_ILLUSIONS_CANTRIP } : null);
    const grantIllusion = illusions && !!illusionRef && !bonus.has(IMPROVED_ILLUSIONS)
      && !cantrips.some((n) => isIllusion(n.ref));
    const lists = refKey(c.ref) === refKey(c.klass.named.ref)
      ? secretSpellLists(c.klass.data, c.level, spellListOf(c.ref, entries.get(refKey(c.ref))?.identifier))
      : [];
    const always = [
      ...upTo(c.klass.data?.spells, c.level).map((r) => ({ spell: named(r, entries), origin: c.klass.named.name })),
      ...(c.subclass
        ? upTo([...(c.subclass.data?.spells ?? []), ...(option?.spells ?? [])], c.level)
          .filter((r) => !(illusions && isIllusion(r)))
          .map((r) => ({ spell: named(r, entries), origin: c.subclass!.named.name }))
        : []),
      ...(grantIllusion ? [{ spell: named(illusionRef!, entries), origin: BONUS_SPELL_ORIGINS[IMPROVED_ILLUSIONS] }] : []),
      ...[...bonus].flatMap(([source, list]) =>
        list.map((spell) => ({ spell, origin: BONUS_SPELL_ORIGINS[source] ?? c.name }))),
      ...(mastery ? [mastery[1], mastery[2]] : [])
        .flatMap((r) => (r ? [{ spell: named(r, entries), origin: SPELL_MASTERY_ORIGIN }] : [])),
    ];
    return {
      class: c.ref,
      name: c.name,
      ability,
      mode,
      dc: 8 + derived.proficiencyBonus + mod,
      attack: derived.proficiencyBonus + mod,
      // (más los trucos de las opciones de rasgo: Taumaturgo…)
      cantripLimit: (c.progressions.cantrips?.[c.level - 1] ?? 0) + heldBonusCantrips(sheet.levels, c.klass.named.ref),
      preparedLimit: c.progressions.prepared?.[c.level - 1] ?? 0,
      maxSpellLevel: maxSpellLevel(progression, c.level),
      known,
      cantrips,
      // (un preparado que también está siempre preparado, p. ej. por la tierra elegida después, no ocupa sitio)
      prepared: mode === "levelUp" ? known.map((k) => k.ref)
        : (sheet.prepared[preparedKey(c.ref)] ?? []).filter((r) => !always.some((a) => refKey(a.spell.ref) === refKey(r))),
      spellbook,
      always,
      ...(c.subclass && options.length
        ? {
          spellOptions: {
            subclass: c.subclass.named.ref, names: options.map((o) => o.name), current: option ? current : null,
            spells: Object.fromEntries(options.map((o) => [o.name, upTo(o.spells, c.level)])),
          },
        }
        : {}),
      ...(lists.length ? { lists } : {}),
      limited,
      ...(mastery ? { mastery } : {}),
      ...(hasFeature(c.klass.data, SIGNATURE_SPELLS, c.level) && !bonus.has(SIGNATURE_SPELLS)
        ? { signatureMissing: true as const } : {}),
    };
  });
}

/**
 * Referencias de los conjuros que tiene el personaje por cualquier vía: trucos, conocidos, libro, siempre preparados
 * y los de especie, legado y dotes.
 */
export function knownSpellRefs(spells: Pick<SpellsSummary, "blocks" | "other">): Ref[] {
  return [
    ...spells.blocks.flatMap((b) => [...b.cantrips, ...b.known, ...b.spellbook, ...b.always.map((a) => a.spell)]),
    ...spells.other.map((o) => o.spell),
  ].map((n) => n.ref);
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
 * nivel total que piden, y los elegidos), clases y subclases que no lanzan (Guerrero psiónico…) e invocaciones (los
 * fijos y los elegidos), con su origen.
 */
export function otherSpells(sheet: Dnd2024SheetV2, entries: Map<string, CatalogEntry>): OtherSpell[] {
  const level = sheet.levels.length;
  const out: OtherSpell[] = [];
  type Grants = { level: number; ref: Ref; ability?: Ability }[] | undefined;
  // `ability`: la elegida con la dote; si no, la de cada concesión y, si no, Inteligencia
  const addGrants = (grants: Grants, origin: string, innate = false, chosen?: Ability) =>
    out.push(...(grants ?? []).filter((g) => g.level <= level).map((g) => {
      const ability = chosen ?? g.ability;
      return {
        spell: named(g.ref, entries), origin, ...(ability ? { ability } : {}),
        ...(innate ? { innate: true as const } : {}),
      };
    }));

  const species = entries.get(refKey(sheet.species.ref))?.data as SpeciesData | undefined;
  addGrants(species?.spells, `Especie: ${sheet.species.name}`, true);
  if (sheet.lineage) {
    const lineage = entries.get(refKey(sheet.lineage.ref))?.data as LineageData | undefined;
    addGrants(lineage?.spells, `Legado: ${sheet.lineage.name}`, true);
  }
  const casterRefs = new Set(casters(sheet, entries).map((c) => refKey(c.ref)));
  for (const c of summarizeClasses(sheet.levels)) {
    if (casterRefs.has(refKey(c.class.ref)) || (c.subclass && casterRefs.has(refKey(c.subclass.ref)))) continue;
    addGrants((entries.get(refKey(c.class.ref))?.data as ClassData | undefined)?.spells?.filter((g) => g.level <= c.level), c.class.name);
    if (!c.subclass) continue;
    const sub = entries.get(refKey(c.subclass.ref))?.data as SubclassData | undefined;
    addGrants(sub?.spells?.filter((g) => g.level <= c.level), c.subclass.name);
  }
  // Dotes: sus conjuros fijos y los elegidos con ellas (solo de las que conserva)
  const chosen = chosenFeatSpells(sheet.levels);
  for (const f of characterFeats(sheet, background(sheet, entries))) {
    const origin = `Dote: ${f.name ?? named(f.ref, entries).name}`;
    const ability = chosenFeatAbility(sheet.levels).get(refKey(f.ref));
    addGrants(featData(f.ref, entries)?.spells, origin, true, ability);
    out.push(...(chosen.get(refKey(f.ref)) ?? []).map((spell) => ({
      spell, origin, innate: true as const, ...(ability ? { ability } : {}),
    })));
  }
  // Invocaciones (y demás rasgos opcionales) con conjuros fijos o elegidos (Pacto del tomo, con su nombre de origen)
  for (const o of heldOptionalFeatures(sheet.levels)) {
    const data = entries.get(refKey(o.ref))?.data as OptionalFeatureData | undefined;
    const name = o.name || named(o.ref, entries).name;
    const kind = data?.featureType?.includes("EI") ? "Invocación" : "Rasgo";
    if (data?.spells?.length) addGrants(data.spells, `${kind}: ${name}`);
    out.push(...(chosen.get(refKey(o.ref)) ?? []).map((spell) => ({ spell, origin: name })));
  }
  return out;
}

const featData = (ref: Ref, entries: Map<string, CatalogEntry>) =>
  entries.get(refKey(ref))?.data as FeatData | undefined;

const background = (sheet: Dnd2024SheetV2, entries: Map<string, CatalogEntry>) =>
  entries.get(refKey(sheet.background.ref))?.data as BackgroundData | undefined;

/**
 * Bloques, espacios, otros conjuros y espacios gastados. `hasSpells`: si la ficha muestra la pestaña Conjuros
 * (también con una dote de conjuros elegidos aunque aún no los tenga: `FeatData.grantsSpells`).
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
    spells: {
      blocks, slots: spellSlots(sheet, entries), other, used: sheet.slotsUsed ?? {}, limitedUsed: sheet.limitedUsed ?? {},
      casting: {
        proficiencyBonus: derived.proficiencyBonus,
        mods: Object.fromEntries(ABILITIES.map((a) => [a, derived.abilities[a].mod])) as Record<Ability, number>,
      },
    },
    hasSpells: blocks.length > 0 || other.length > 0 || spellFeat,
  };
}
