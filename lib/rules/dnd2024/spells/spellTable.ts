// Tabla de conjuros de la ficha (spec de la tabla de conjuros §2.1): una fila por conjuro que el personaje puede
// lanzar. Lo común con las Acciones (conjuros utilizables, tirada y tipo de daño) vive aquí.
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import { DEFAULT_SPELL_ABILITY, innateKey, innateMax, type CasterBlock, type CastingStats, type SpellsSummary } from "@/lib/rules/dnd2024/derive/spells";
import { refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import { ABILITY_ABBR, ABILITY_NAMES, DAMAGE_TYPE_NAMES, fmtMod } from "@/lib/rules/dnd2024/sheet/labels";
import { spellRangeParts, type SpellArea } from "@/lib/rules/dnd2024/spells/spellArea";
import { spellSchoolName } from "@/lib/rules/dnd2024/spells/spellTextClient";
import type { Ability, Ref, SpellData } from "@/lib/rules/types";

export type SpellRow = {
  ref: Ref; key: string; name: string; nameEn: string; level: number; school: string;
  /** Letra de escuela de 5etools (`V`), para su icono. */
  schoolId: string;
  time: string; timeShort: string; range: string; area: SpellArea | null; duration: string; components: string;
  concentration: boolean; ritual: boolean;
  /** «+N» con ataque de conjuro, «CD N {Car}» con salvación; null sin tirada. */
  hit: string | null;
  /** Primer «Daño de …», si no primer «Estado: …», si no la primera etiqueta que no sea de tirada, área ni duración. */
  effect: { damageTypeId: string | null; label: string } | null;
  /** Dados de daño o de curación (`healing`), con el tipo de daño; null si el conjuro no hace ni una cosa ni otra. */
  damage: { dice: string; damageTypeId: string | null; healing: boolean } | null;
  /** Clase con la que se prepara (interruptor de la tabla); null si no se prepara (trucos, siempre preparados, aprendidos…). */
  prepare: Ref | null;
  /** «Mago», «Especie: Tiefling», «Dote: …». */
  origin: string;
  /** Arcano místico, conjuros distintivos y de especie con usos por descanso largo. */
  limited: { key: string; max: number; used: number } | null;
  /** Bloque que lo lanza (para el espacio y la CD); null en los de especie y dotes. */
  casterClass: Ref | null;
  tags: string[];
};

// «Daño de fuego» / «Daño necrótico» → "fire" / "necrotic" (etiquetas de `spellTags`)
const DAMAGE_IDS = new Map(Object.entries(DAMAGE_TYPE_NAMES).map(([id, name]) => [name.toLowerCase(), id]));
export const damageIdOf = (tag: string) => {
  const m = /^Daño (?:de )?(.+)$/.exec(tag);
  return m ? (DAMAGE_IDS.get(m[1].toLowerCase()) ?? null) : null;
};
// «Salvación de Destreza» → "dex"
const SAVE_ABILITIES = new Map(Object.entries(ABILITY_NAMES).map(([a, name]) => [`Salvación de ${name}`, a as Ability]));
const SPELL_ATTACK_TAG = "Ataque de conjuro";

/** Ataque y CD de un lanzador: los de su bloque o, en especie, legado y dotes, los de su característica. */
export type CastingBonus = { attack: number; dc: number };

/** Ataque y CD de un conjuro de `other`: competencia + modificador de su característica (Inteligencia por defecto). */
export function otherCasting(ability: Ability | undefined, casting: CastingStats | undefined): CastingBonus | null {
  if (!casting) return null;
  const attack = casting.proficiencyBonus + casting.mods[ability ?? DEFAULT_SPELL_ABILITY];
  return { attack, dc: 8 + attack };
}

// «+N» con ataque de conjuro, «CD N {Car}» con salvación; null sin tirada o sin quien lo lance
export function hitOf(tags: string[], caster: CastingBonus | null): string | null {
  if (!caster) return null;
  if (tags.includes(SPELL_ATTACK_TAG)) return fmtMod(caster.attack);
  const save = tags.map((t) => SAVE_ABILITIES.get(t)).find((a) => a);
  return save ? `CD ${caster.dc} ${ABILITY_ABBR[save]}` : null;
}

/**
 * Dados de daño del conjuro: en los trucos, el último escalón alcanzado por el nivel de personaje (`level`); en los
 * de nivel 1+, sus dados base. null sin daño.
 */
export function spellDamageAt(data: SpellData, level: number): string | null {
  const damage = data.damage;
  if (!damage) return null;
  if (data.level > 0 || !damage.scaling?.length) return damage.dice;
  const reached = damage.scaling.filter((s) => s.level <= level).sort((a, b) => a.level - b.level).at(-1);
  return reached?.dice ?? damage.dice;
}

export type UsableSpell = {
  ref: Ref; block: CasterBlock | null; origin: string; entry: CatalogEntry; data: SpellData;
  /** Ataque y CD con que se lanza: los del bloque o, en los de `other`, los de su característica (null sin datos). */
  caster: CastingBonus | null;
  limited: { key: string; max: number; used: number } | null;
};

/**
 * Conjuros que se pueden lanzar, como en la pestaña Conjuros: trucos, preparados (en modo `levelUp`, los aprendidos;
 * en el Mago, los preparados de su libro), siempre preparados y con usos de cada bloque, y los de especie, legado y
 * dotes; cada uno una vez (el primero que aparece). Sin entrada en el catálogo no se sabe cuánto cuesta lanzarlo
 * (derive ya lo avisa en `missing`) y se omite.
 */
export function usableSpells(spells: SpellsSummary, entries: Map<string, CatalogEntry>): UsableSpell[] {
  type Source = Pick<UsableSpell, "ref" | "block" | "origin" | "limited" | "caster">;
  const sources: Source[] = [
    ...spells.blocks.flatMap((b) => [
      ...b.cantrips.map((n) => ({ ref: n.ref, block: b, origin: b.name, limited: null, caster: b })),
      ...b.prepared.map((r) => ({ ref: r, block: b, origin: b.name, limited: null, caster: b })),
      ...b.always.map((a) => ({ ref: a.spell.ref, block: b, origin: a.origin, limited: null, caster: b })),
      ...b.limited.map((l) => ({
        ref: l.spell.ref, block: b, origin: l.origin, limited: { key: l.key, max: l.max, used: l.used }, caster: b,
      })),
    ]),
    // (los de especie, legado y dotes de nivel 1+: un uso gratis por descanso largo; los trucos se lanzan a voluntad)
    ...spells.other.map((o) => {
      const key = innateKey(o.spell.ref);
      const max = innateMax(o.uses, spells.casting?.proficiencyBonus);
      const limited = o.innate ? { key, max, used: Math.min(spells.limitedUsed[key] ?? 0, max) } : null;
      return { ref: o.spell.ref, block: null, origin: o.origin, limited, caster: otherCasting(o.ability, spells.casting) };
    }),
  ];
  const out = new Map<string, UsableSpell>();
  for (const s of sources) {
    const key = refKey(s.ref);
    const entry = entries.get(key);
    if (!entry) continue;
    if (s.limited && (entry.data as SpellData).level === 0) s.limited = null;
    const seen = out.get(key);
    // Si ya estaba, solo se le añaden los usos (un conjuro preparado que también es un arcano conserva sus casillas)
    if (seen) {
      seen.limited ??= s.limited;
      continue;
    }
    out.set(key, { ...s, entry, data: entry.data as SpellData });
  }
  return [...out.values()];
}

/** «1 acción» → «1A», «1 acción adicional» → «1AA», «1 reacción…» → «1R», «N minutos» → «N min», «N horas» → «N h». */
export function timeShort(time: string): string {
  if (time.startsWith("1 acción adicional")) return "1AA";
  if (time.startsWith("1 reacción")) return "1R";
  if (time.startsWith("1 acción")) return "1A";
  const m = /^(\d+) (minutos?|horas?)\b/.exec(time);
  return m ? `${m[1]} ${m[2].startsWith("min") ? "min" : "h"}` : time;
}

const NOT_EFFECT = /^(Salvación de |Área: |Ataque de conjuro$|Concentración$|Ritual$)/;
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function effectOf(tags: string[], data: SpellData): SpellRow["effect"] {
  if (data.healing) return { damageTypeId: null, label: `${data.healing.dice} Curación` };
  const damage = tags.find((t) => damageIdOf(t));
  if (damage) {
    const damageTypeId = damageIdOf(damage)!;
    return { damageTypeId, label: DAMAGE_TYPE_NAMES[damageTypeId] };
  }
  const state = tags.find((t) => t.startsWith("Estado: "));
  if (state) return { damageTypeId: null, label: capitalize(state.slice("Estado: ".length)) };
  const misc = tags.find((t) => !NOT_EFFECT.test(t));
  return misc ? { damageTypeId: null, label: misc } : null;
}

function damageOf(data: SpellData, level: number): SpellRow["damage"] {
  if (data.healing) return { dice: data.healing.dice, damageTypeId: null, healing: true };
  const dice = spellDamageAt(data, level);
  if (!dice) return null;
  return { dice, damageTypeId: data.tags.map(damageIdOf).find((id) => !!id) ?? null, healing: false };
}

/** Lo que hace falta para ofrecer también los conjuros aún sin preparar. */
export type SpellTableOptions = {
  /** Nivel total del personaje (los dados de los trucos suben con él). */
  level?: number;
  /** Listas de conjuros de un bloque (`SpellData.classes`); con ellas salen también los que puede preparar. */
  listsOf?: (block: CasterBlock) => string[];
};

const canPrepareBlock = (block: CasterBlock | null) => !!block && block.mode !== "levelUp" && block.preparedLimit > 0;

/**
 * Una fila por conjuro utilizable, en el orden en que aparecen en la ficha y, con `listsOf`, una por cada conjuro que
 * podría preparar: en el Mago, los de su libro; en el resto, los de su lista hasta su nivel máximo.
 */
export function spellTableRows(spells: SpellsSummary, entries: Map<string, CatalogEntry>, options: SpellTableOptions = {}): SpellRow[] {
  const level = options.level ?? 1;
  const row = (ref: Ref, entry: CatalogEntry, data: SpellData, caster: CastingBonus | null, origin: string, limited: SpellRow["limited"], block: CasterBlock | null, prepare: Ref | null): SpellRow => ({
    ref, key: refKey(ref), name: entry.nameEs ?? entry.name, nameEn: entry.name, level: data.level,
    school: spellSchoolName(data.school), schoolId: data.school, time: data.time, timeShort: timeShort(data.time), ...spellRangeParts(data.range, data.area),
    duration: data.duration, components: data.components, concentration: data.concentration, ritual: data.ritual,
    hit: hitOf(data.tags, caster), effect: effectOf(data.tags, data), damage: damageOf(data, level), prepare, origin, limited,
    casterClass: block?.class ?? null, tags: data.tags,
  });

  const rows = usableSpells(spells, entries).map(({ ref, block, caster, origin, entry, data, limited }) => {
    const prepared = canPrepareBlock(block) && block!.prepared.some((p) => refKey(p) === refKey(ref));
    return row(ref, entry, data, caster, origin, limited, block, prepared ? block!.class : null);
  });

  if (options.listsOf) {
    const seen = new Set(rows.map((r) => r.key));
    for (const block of spells.blocks) {
      if (!canPrepareBlock(block)) continue;
      const lists = options.listsOf(block);
      const candidates = block.mode === "spellbook"
        ? block.spellbook.map((s) => entries.get(refKey(s.ref))).filter((e) => !!e)
        : [...entries.values()].filter((e) => e.ref.key.startsWith("spell:") && (e.data as SpellData).classes?.some((c) => lists.includes(c)));
      for (const entry of candidates) {
        const data = entry.data as SpellData;
        const key = refKey(entry.ref);
        if (seen.has(key) || data.level < 1 || data.level > block.maxSpellLevel) continue;
        seen.add(key);
        rows.push(row(entry.ref, entry, data, block, block.name, null, block, block.class));
      }
    }
  }
  return rows;
}
