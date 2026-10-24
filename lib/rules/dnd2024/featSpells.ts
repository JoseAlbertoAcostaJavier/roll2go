// Conjuros que se eligen con una dote (Iniciado en la magia, Lanzador de rituales, la mitad elegida de Tocado por los
// feéricos…): qué piden (`FeatData.spellChoices`), su validación en el servidor y los que conserva el personaje. Las
// elecciones van a `levels[].choices` como `featSpells`, en el nivel en que se gana la dote (el 1 para la del
// trasfondo) o en el que la dote da más (Lanzador de rituales). Funciones puras.
import type { CatalogEntry } from "@/lib/rules/catalog";
import type { Ability, FeatData, FeatSpellFilter, Ref, SpellData } from "@/lib/rules/types";
import { refKey } from "./equipmentRefs";
import type { PendingChoice } from "./levels";
import type { Choice, FeatSpellsValue, LevelEntry, Named } from "./sheet";

/** Fuente de la elección de conjuros de una dote. */
export const featSpellsSource = (feat: Ref) => `featSpells:${feat.key}`;

/** Dote que puede pedir conjuros: su referencia, su nombre y sus datos. */
export type FeatWithData = { ref: Ref; name: string; data: FeatData | null | undefined };

/**
 * Elecciones `featSpells` de las dotes `feats`: las partes de `spellChoices` cuyo nivel de personaje cumple `at` (al
 * ganar la dote, las de su nivel o menos; después, las del nivel nuevo). Los trucos y los conjuros se cuentan aparte
 * en `spells` (con la dote en lugar de la clase) y sus filtros van en `featSpells`.
 */
export function featSpellPending(feats: FeatWithData[], at: (level: number) => boolean): PendingChoice[] {
  const out: PendingChoice[] = [];
  for (const f of feats) {
    const parts = (f.data?.spellChoices ?? []).filter((c) => at(c.level));
    if (!parts.length) continue;
    const cantrips = parts.filter((c) => c.filter.level === 0);
    const spells = parts.filter((c) => c.filter.level > 0);
    const count = (list: typeof parts) => list.reduce((n, c) => n + c.count, 0);
    out.push({
      type: "featSpells", source: featSpellsSource(f.ref), count: count(parts), label: `Conjuros de ${f.name}`,
      spells: {
        class: f.ref, mode: "levelUp", list: "", cantrips: count(cantrips), spells: count(spells),
        maxLevel: Math.max(0, ...spells.map((c) => c.filter.level)),
      },
      featSpells: {
        feat: f.ref,
        ...(cantrips.length ? { cantrip: cantrips[0].filter } : {}),
        ...(spells.length ? { spell: spells[0].filter } : {}),
        ...(f.data?.spellAbility?.length ? { abilities: f.data.spellAbility } : {}),
      },
    });
  }
  return out;
}

/** Si un conjuro cumple el filtro de la dote: su nivel y, si los pide, la lista de clase, la escuela y el ritual. */
export function fitsFeatSpell(data: SpellData | null | undefined, filter: FeatSpellFilter | undefined): boolean {
  if (!data || !filter || data.level !== filter.level) return false;
  if (filter.classes && !filter.classes.some((c) => data.classes?.includes(c))) return false;
  if (filter.schools && !filter.schools.includes(data.school)) return false;
  return !filter.ritual || data.ritual;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const asRef = (v: unknown): Ref | null => {
  const r = isObj(v) && isObj(v.ref) ? v.ref : v;
  return isObj(r) && typeof r.book === "string" && typeof r.key === "string" ? { book: r.book, key: r.key } : null;
};
const nameOf = (e: CatalogEntry) => e.nameEs || e.name;

/**
 * Comprueba las elecciones `featSpells` de `given` contra las que pide el nivel (ni más ni menos) y devuelve las
 * elecciones con los nombres del catálogo. Errores en `<path>` (faltan o sobran) y `<path>.<source>`.
 */
export async function checkFeatSpellChoices(
  pending: PendingChoice[],
  given: unknown[],
  ctx: { path: string; books: string[]; resolve: (ref: Ref) => Promise<CatalogEntry | null> },
): Promise<{ choices: Choice[]; errors: Record<string, string> }> {
  const errors: Record<string, string> = {};
  const err = (k: string, msg: string) => {
    if (!errors[k]) errors[k] = msg;
  };
  const list = given.filter(isObj);
  if (list.some((c) => !pending.some((p) => p.source === c.source))) err(ctx.path, "Hay elecciones que este nivel no pide.");
  const missing = pending.filter((p) => !list.some((c) => c.source === p.source));
  if (missing.length) err(ctx.path, `Falta elegir: ${missing.map((p) => p.label).join(", ")}.`);

  const load = async (v: unknown): Promise<CatalogEntry | null> => {
    const ref = asRef(v);
    if (!ref || !ref.key.startsWith("spell:") || !ctx.books.includes(ref.book)) return null;
    return ctx.resolve(ref);
  };
  const choices: Choice[] = [];
  for (const p of pending) {
    const raw = list.find((c) => c.source === p.source);
    if (!raw || !p.spells || !p.featSpells) continue;
    const r = await checkOne(p, raw.value, load);
    if ("error" in r) err(`${ctx.path}.${p.source}`, `${p.label}: ${r.error}`);
    else choices.push({ type: "featSpells", source: p.source, value: r.value });
  }
  return { choices, errors };
}

async function checkOne(
  p: PendingChoice, raw: unknown, load: (v: unknown) => Promise<CatalogEntry | null>,
): Promise<{ error: string } | { value: FeatSpellsValue }> {
  const fs = p.featSpells!;
  if (!isObj(raw)) return { error: "elige los conjuros." };
  const pick = async (items: unknown, count: number, filter: FeatSpellFilter | undefined, cantrip: boolean) => {
    const what = cantrip ? (count === 1 ? "truco" : "trucos") : (count === 1 ? "conjuro" : "conjuros");
    const values = items ?? [];
    if (!Array.isArray(values) || values.length !== count) return { error: `elige ${count} ${what}.` };
    const found = await Promise.all(values.map(load));
    if (found.some((e) => !e)) return { error: "conjuro no disponible." };
    const bad = (found as CatalogEntry[]).find((e) => !fitsFeatSpell(e.data as SpellData | null, filter));
    return bad ? { error: `${nameOf(bad)} no se puede elegir con esta dote.` } : (found as CatalogEntry[]);
  };
  const cantrips = await pick(raw.cantrips, p.spells!.cantrips, fs.cantrip, true);
  if ("error" in cantrips) return cantrips;
  const spells = await pick(raw.spells, p.spells!.spells, fs.spell, false);
  if ("error" in spells) return spells;
  const chosen = [...cantrips, ...spells];
  if (new Set(chosen.map((e) => refKey(e.ref))).size !== chosen.length) return { error: "conjuro repetido." };
  const ability = raw.ability as Ability | undefined;
  if (fs.abilities ? !fs.abilities.includes(ability as Ability) : ability !== undefined)
    return { error: "elige la característica de lanzamiento." };
  const toNamed = (e: CatalogEntry): Named => ({ ref: { book: e.ref.book, key: e.ref.key }, name: nameOf(e) });
  return {
    value: { feat: fs.feat, cantrips: cantrips.map(toNamed), spells: spells.map(toNamed), ...(ability ? { ability } : {}) },
  };
}

/** Conjuros elegidos con cada dote en el historial (una dote puede dar más en niveles posteriores). */
export function chosenFeatSpells(levels: LevelEntry[]): Map<string, Named[]> {
  const out = new Map<string, Named[]>();
  for (const l of levels) {
    for (const c of l.choices) {
      if (c.type !== "featSpells") continue;
      const k = refKey(c.value.feat);
      out.set(k, [...(out.get(k) ?? []), ...c.value.cantrips, ...c.value.spells]);
    }
  }
  return out;
}

/** Elecciones que aún no son `featSpells` (las de la clase) y las que sí, de una lista del cliente. */
export function splitFeatSpells(raw: unknown): { rest: unknown; featSpells: unknown[] } {
  if (!Array.isArray(raw)) return { rest: raw, featSpells: [] };
  const isFs = (c: unknown) => isObj(c) && c.type === "featSpells";
  return { rest: raw.filter((c) => !isFs(c)), featSpells: raw.filter(isFs) };
}
