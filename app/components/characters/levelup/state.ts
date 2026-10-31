// Estado del asistente de subir de nivel: borrador en localStorage, qué falta en cada paso y las elecciones que se
// envían a `POST /api/characters/[id]/levels`.
import type { EntryOption } from "@/lib/rules/catalog/types";
import type { PendingChoice } from "@/lib/rules/dnd2024/levels/pendingChoices";
import type { Choice } from "@/lib/rules/dnd2024/sheet/sheet";
import {
  bonusChoiceOf, bonusPickMissing, featSpellsChoiceOf, featSpellsMissing, parseSpellPick, spellChoiceOf, spellPickMissing,
  type SpellPick,
} from "@/lib/rules/dnd2024/spells/spellPicks";
import { SUBCLASS_SOURCE } from "@/lib/rules/dnd2024/sheet/upgrade";
import { ABILITIES, type Ability, type FeatData } from "@/lib/rules/types";
import { choicesFor, refFromKey, type ChoiceValues } from "../creator/ClassFeaturesSection";

/** PG del nivel: la media o una tirada firmada, con el dado con que se obtuvieron (si cambia la clase, no valen). */
export type HpPick = { method: "average" | "roll"; value: number; die: number; token?: string };

/** Mejora de característica: +2 a una o +1 a dos, o una dote general (y la característica que sube, si da). */
export type AsiPick = {
  mode: "abilities" | "feat"; abilities: Partial<Record<Ability, number>>; feat: string; ability: Ability | "";
  /** Tipos de daño de la dote, si da una resistencia a elegir. */
  resist: string[];
};

export type LevelUpState = {
  /** Clase en la que sube (`libro:clave`). */
  classKey: string;
  subclassKey: string;
  /** Habilidades, pericias, maestrías, opciones de rasgo, dotes y rasgos opcionales, por `source`. */
  values: ChoiceValues;
  /** Dote o rasgo opcional que sustituye, por `source` ("" = ninguno). */
  replaced: Record<string, string>;
  /** Característica que mejora cada dote elegida, por `featAbilityKey`; y la de lanzamiento de sus conjuros, por `source`. */
  featAbility: Record<string, Ability>;
  /** Tipos de daño que resiste cada dote elegida (si da una resistencia a elegir), por `featAbilityKey`. */
  featResist: Record<string, string[]>;
  asi: Record<string, AsiPick>;
  /**
   * Conjuros elegidos y sustituciones, por `source` (también los de las dotes, con su lista, el Arcano místico y los
   * conjuros de rasgos).
   */
  spells: Record<string, SpellPick>;
  hp: HpPick | null;
  /** Paso en el que estaba. */
  step: string;
};

export const ASI_POINTS = 2;
export const ABILITY_CAP = 20;
const EPIC_CAP = 30;

export const emptyAsi = (): AsiPick => ({ mode: "abilities", abilities: {}, feat: "", ability: "", resist: [] });
export const featAbilityKey = (source: string, featKey: string) => `${source} ${featKey}`;
export const draftKeyOf = (characterId: string, n: number) => `roll2go:level-up:${characterId}:${n}`;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const strings = (v: unknown) => (Array.isArray(v) ? v.map(str) : []);
const isAbility = (v: unknown): v is Ability => ABILITIES.includes(v as Ability);
const record = <T,>(v: unknown, item: (x: unknown) => T | null): Record<string, T> => {
  const out: Record<string, T> = {};
  if (isObj(v)) for (const [k, x] of Object.entries(v)) {
    const parsed = item(x);
    if (parsed !== null) out[k] = parsed;
  }
  return out;
};

/** Recupera el borrador comprobando cada campo; lo que no encaja se descarta (las opciones se revisan al pintar). */
export function parseDraft(raw: string | null, fallback: LevelUpState): LevelUpState {
  let d: unknown;
  try {
    d = raw ? JSON.parse(raw) : null;
  } catch {
    d = null;
  }
  if (!isObj(d)) return fallback;
  const hp = isObj(d.hp) && (d.hp.method === "average" || d.hp.method === "roll")
    && typeof d.hp.value === "number" && typeof d.hp.die === "number"
    ? { method: d.hp.method, value: d.hp.value, die: d.hp.die, ...(typeof d.hp.token === "string" ? { token: d.hp.token } : {}) } as HpPick
    : null;
  return {
    classKey: str(d.classKey) || fallback.classKey,
    subclassKey: str(d.subclassKey),
    values: record(d.values, (x) => strings(x)),
    replaced: record(d.replaced, (x) => (typeof x === "string" ? x : null)),
    featAbility: record(d.featAbility, (x) => (isAbility(x) ? x : null)),
    featResist: record(d.featResist, (x) => (Array.isArray(x) ? strings(x) : null)),
    asi: record(d.asi, (x) => (isObj(x)
      ? {
        mode: x.mode === "feat" ? "feat" : "abilities",
        abilities: record(x.abilities, (n) => (n === 1 || n === 2 ? n : null)),
        feat: str(x.feat),
        ability: isAbility(x.ability) ? x.ability : "",
        resist: strings(x.resist),
      }
      : null)),
    spells: record(d.spells, (x) => parseSpellPick(x)),
    hp,
    step: str(d.step),
  };
}

/** Lo que aporta una dote a las características: las que puede subir y cuál sube (sola o la elegida). */
export function featAbility(feat: EntryOption | undefined, chosen: Ability | "" | undefined) {
  const data = feat?.data as FeatData | null | undefined;
  const from = data?.abilityIncrease ?? [];
  const ability = from.length === 1 ? from[0] : chosen && from.includes(chosen) ? chosen : null;
  return { from, ability, cap: data?.category === "epicBoon" ? EPIC_CAP : ABILITY_CAP };
}

/** La resistencia a elegir de una dote (`choose`): de qué tipos de daño y cuántos; null si no tiene. */
export function featResistChoose(feat: EntryOption | undefined): { from: string[]; count: number } | null {
  const list = (feat?.data as FeatData | null | undefined)?.defenses?.resist ?? [];
  for (const x of list) if (typeof x !== "string") return x.choose;
  return null;
}

/** Los tipos de daño elegidos si están completos y son válidos para la dote; si no, null. */
function validResist(feat: EntryOption | undefined, chosen: string[] | undefined): string[] | null {
  const choose = featResistChoose(feat);
  const given = (chosen ?? []).filter(Boolean);
  if (!choose) return null;
  return given.length === choose.count && new Set(given).size === given.length && given.every((t) => choose.from.includes(t)) ? given : null;
}

const sum = (abilities: Partial<Record<Ability, number>>) => Object.values(abilities).reduce((s, v) => s + (v ?? 0), 0);

export type ChoiceEnv = {
  pending: PendingChoice[];
  state: LevelUpState;
  feats: EntryOption[];
  /** Puntuación actual de cada característica. */
  scores: Record<Ability, number>;
};

/** Cuántas dotes o rasgos opcionales hay que elegir en esta elección (uno más si sustituye otro). */
export const slotsFor = (p: PendingChoice, state: LevelUpState) => p.count + (p.optionalReplace && state.replaced[p.source] ? 1 : 0);

/** Lo que falta en una elección («elegir 2 habilidades»…); null si está completa. */
export function missingChoice(p: PendingChoice, env: ChoiceEnv): string | null {
  const { state, feats, scores } = env;
  const featOf = (k: string) => feats.find((f) => `${f.ref.book}:${f.ref.key}` === k);
  if (p.type === "subclass") return state.subclassKey ? null : "elegir una subclase";
  if (p.type === "asi") {
    const a = state.asi[p.source] ?? emptyAsi();
    if (a.mode === "abilities") {
      const left = ASI_POINTS - sum(a.abilities);
      return left > 0 ? `repartir ${left} ${left === 1 ? "punto" : "puntos"} de mejora` : null;
    }
    if (!a.feat) return "elegir una dote";
    const fa = featAbility(featOf(a.feat), a.ability);
    if (fa.from.length && !fa.ability) return "elegir la característica que mejora la dote";
    if (fa.ability && scores[fa.ability] + 1 > fa.cap) return `una característica que no pase de ${fa.cap}`;
    if (featResistChoose(featOf(a.feat)) && !validResist(featOf(a.feat), a.resist)) return "elegir los tipos de daño de la dote";
    return null;
  }
  if (p.type === "spells") return spellPickMissing(p, state.spells[p.source]);
  if (p.type === "featSpells") return featSpellsMissing(p, state.spells[p.source], state.featAbility[p.source]);
  if (p.type === "arcanum" || p.type === "bonusSpells") return bonusPickMissing(p, state.spells[p.source]);
  const chosen = (state.values[p.source] ?? []).slice(0, slotsFor(p, state)).filter(Boolean);
  const left = slotsFor(p, state) - chosen.length;
  if (left > 0) return `elegir ${left} ${left === 1 ? "opción" : "opciones"} en ${p.label}`;
  if (p.type === "feat") {
    for (const k of chosen) {
      const fa = featAbility(featOf(k), state.featAbility[featAbilityKey(p.source, k)]);
      if (fa.from.length && !fa.ability) return "elegir la característica que mejora la dote";
      if (featResistChoose(featOf(k)) && !validResist(featOf(k), state.featResist[featAbilityKey(p.source, k)])) {
        return "elegir los tipos de daño de la dote";
      }
    }
  }
  return null;
}

/** Elecciones para enviar (sin nombres: los pone el servidor), en el orden de `pending`. */
export function buildChoices(env: ChoiceEnv): Choice[] {
  const { pending, state, feats } = env;
  const named = (k: string) => ({ ref: refFromKey(k), name: "" });
  return pending.flatMap((p): Choice[] => {
    const replaced = p.optionalReplace && state.replaced[p.source] ? [named(state.replaced[p.source])] : [];
    const picked = (state.values[p.source] ?? []).slice(0, slotsFor(p, state)).filter(Boolean);
    switch (p.type) {
      case "subclass":
        return state.subclassKey ? [{ type: "subclass", source: SUBCLASS_SOURCE, value: named(state.subclassKey) }] : [];
      case "asi": {
        const a = state.asi[p.source] ?? emptyAsi();
        if (a.mode === "abilities") {
          const abilities = Object.fromEntries(Object.entries(a.abilities).filter(([, v]) => v)) as Partial<Record<Ability, 1 | 2>>;
          return [{ type: "asi", source: p.source, value: { abilities } }];
        }
        const feat = feats.find((f) => `${f.ref.book}:${f.ref.key}` === a.feat);
        const ability = featAbility(feat, a.ability).ability;
        const resist = validResist(feat, a.resist);
        return [{ type: "asi", source: p.source, value: { feat: named(a.feat), ...(ability ? { ability } : {}), ...(resist ? { resist } : {}) } }];
      }
      case "feat":
        // Con `count: 0` y sin sustituir nada, no se envía
        if (!picked.length && !replaced.length && p.count === 0) return [];
        return [{
          type: "feat", source: p.source,
          value: picked.map((k) => {
            const feat = feats.find((f) => `${f.ref.book}:${f.ref.key}` === k);
            const ability = featAbility(feat, state.featAbility[featAbilityKey(p.source, k)]).ability;
            const resist = validResist(feat, state.featResist[featAbilityKey(p.source, k)]);
            return { ...named(k), ...(ability ? { ability } : {}), ...(resist ? { resist } : {}) };
          }),
          ...(replaced.length ? { replaced } : {}),
        }];
      case "optionalFeature":
        if (!picked.length && !replaced.length && p.count === 0) return [];
        return [{ type: "optionalFeature", source: p.source, value: picked.map(named), ...(replaced.length ? { replaced } : {}) }];
      case "spells": {
        const c = spellChoiceOf(p, state.spells[p.source]);
        return c ? [c] : [];
      }
      case "featSpells": {
        const c = featSpellsChoiceOf(p, state.spells[p.source], state.featAbility[p.source]);
        return c ? [c] : [];
      }
      case "arcanum":
      case "bonusSpells": {
        const c = bonusChoiceOf(p, state.spells[p.source]);
        return c ? [c] : [];
      }
      default:
        return choicesFor([p], state.values);
    }
  });
}
