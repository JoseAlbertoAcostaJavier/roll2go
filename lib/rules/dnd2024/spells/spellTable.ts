// Tabla de conjuros de la ficha (spec de la tabla de conjuros §2.1): una fila por conjuro que el personaje puede
// lanzar. Lo común con las Acciones (conjuros utilizables, tirada y tipo de daño) vive aquí.
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import type { CasterBlock, SpellsSummary } from "@/lib/rules/dnd2024/derive/spells";
import { refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import { ABILITY_ABBR, ABILITY_NAMES, DAMAGE_TYPE_NAMES, fmtMod } from "@/lib/rules/dnd2024/sheet/labels";
import { spellSchoolName } from "@/lib/rules/dnd2024/spells/spellTextClient";
import type { Ability, Ref, SpellData } from "@/lib/rules/types";

export type SpellRow = {
  ref: Ref; key: string; name: string; nameEn: string; level: number; school: string;
  /** Letra de escuela de 5etools (`V`), para su icono. */
  schoolId: string;
  time: string; timeShort: string; range: string; duration: string; components: string;
  concentration: boolean; ritual: boolean;
  /** «+N» con ataque de conjuro, «CD N {Car}» con salvación; null sin tirada. */
  hit: string | null;
  /** Primer «Daño de …», si no primer «Estado: …», si no la primera etiqueta que no sea de tirada, área ni duración. */
  effect: { damageTypeId: string | null; label: string } | null;
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

// «+N» con ataque de conjuro, «CD N {Car}» con salvación; null sin tirada o sin bloque lanzador (especie, dotes: no
// se guarda con qué característica los lanza)
export function hitOf(tags: string[], block: CasterBlock | null): string | null {
  if (!block) return null;
  if (tags.includes(SPELL_ATTACK_TAG)) return fmtMod(block.attack);
  const save = tags.map((t) => SAVE_ABILITIES.get(t)).find((a) => a);
  return save ? `CD ${block.dc} ${ABILITY_ABBR[save]}` : null;
}

export type UsableSpell = {
  ref: Ref; block: CasterBlock | null; origin: string; entry: CatalogEntry; data: SpellData;
  limited: { key: string; max: number; used: number } | null;
};

/**
 * Conjuros que se pueden lanzar, como en la pestaña Conjuros: trucos, preparados (en modo `levelUp`, los aprendidos;
 * en el Mago, los preparados de su libro), siempre preparados y con usos de cada bloque, y los de especie, legado y
 * dotes; cada uno una vez (el primero que aparece). Sin entrada en el catálogo no se sabe cuánto cuesta lanzarlo
 * (derive ya lo avisa en `missing`) y se omite.
 */
export function usableSpells(spells: SpellsSummary, entries: Map<string, CatalogEntry>): UsableSpell[] {
  const sources: { ref: Ref; block: CasterBlock | null; origin: string; limited: UsableSpell["limited"] }[] = [
    ...spells.blocks.flatMap((b) => [
      ...b.cantrips.map((n) => ({ ref: n.ref, block: b, origin: b.name, limited: null })),
      ...b.prepared.map((r) => ({ ref: r, block: b, origin: b.name, limited: null })),
      ...b.always.map((a) => ({ ref: a.spell.ref, block: b, origin: a.origin, limited: null })),
      ...b.limited.map((l) => ({
        ref: l.spell.ref, block: b, origin: l.origin, limited: { key: l.key, max: l.max, used: l.used },
      })),
    ]),
    ...spells.other.map((o) => ({ ref: o.spell.ref, block: null, origin: o.origin, limited: null })),
  ];
  const out = new Map<string, UsableSpell>();
  for (const s of sources) {
    const key = refKey(s.ref);
    const entry = entries.get(key);
    if (!entry) continue;
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

function effectOf(tags: string[]): SpellRow["effect"] {
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

/** Una fila por conjuro utilizable, en el orden en que aparecen en la ficha. */
export function spellTableRows(spells: SpellsSummary, entries: Map<string, CatalogEntry>): SpellRow[] {
  return usableSpells(spells, entries).map(({ ref, block, origin, entry, data, limited }) => ({
    ref, key: refKey(ref), name: entry.nameEs ?? entry.name, nameEn: entry.name, level: data.level,
    school: spellSchoolName(data.school), schoolId: data.school, time: data.time, timeShort: timeShort(data.time), range: data.range,
    duration: data.duration, components: data.components, concentration: data.concentration, ritual: data.ritual,
    hit: hitOf(data.tags, block), effect: effectOf(data.tags), origin, limited,
    casterClass: block?.class ?? null, tags: data.tags,
  }));
}
