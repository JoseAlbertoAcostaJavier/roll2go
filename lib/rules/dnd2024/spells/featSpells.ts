// Conjuros que se eligen con una dote (Iniciado en la magia, Lanzador de rituales, la mitad elegida de Tocado por los
// feéricos…) o con una invocación (Pacto del tomo): qué piden (`spellChoices`), su validación en el servidor y los que
// conserva el personaje. Las elecciones van a `levels[].choices` como `featSpells`, en el nivel en que se gana la dote
// (el 1 para la del trasfondo) o en el que la dote da más (Lanzador de rituales); Iniciado en la magia, además, deja
// cambiar uno de sus conjuros en cada subida (`replace`). Funciones puras.
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import type { Ability, FeatData, FeatSpellFilter, Ref, SpellData } from "@/lib/rules/types";
import { refKey } from "../sheet/equipmentRefs";
import type { PendingChoice } from "../levels/pendingChoices";
import type { Choice, FeatSpellsValue, LevelEntry, Named } from "../sheet/sheet";

/** Fuente de la elección de conjuros de una dote. */
export const featSpellsSource = (feat: Ref) => `featSpells:${feat.key}`;

/**
 * Dote (o invocación) que puede pedir conjuros: su referencia, su nombre y sus datos (`FeatData` u
 * `OptionalFeatureData`).
 */
export type FeatWithData = {
  ref: Ref; name: string; data: Pick<FeatData, "spellChoices" | "spellAbility"> | null | undefined;
};

// Iniciado en la magia del XPHB (la base y sus versiones por lista): «Cambio de conjuro» en cada subida de nivel
const SPELL_CHANGE = /^feat:magic initiate(; [^|]+)?\|xphb$/;

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
        ...(parts.some((c) => c.lists) ? { lists: parts.find((c) => c.lists)!.lists } : {}),
      },
    });
  }
  return out;
}

/**
 * Elecciones `featSpells` de una subida al nivel total `n`: las de las dotes e invocaciones que gana ahora (`gained`,
 * hasta ese nivel) y, de las que ya tenía (`held`), las partes de ese nivel; las que nunca eligieron sus conjuros
 * porque llegaron después (la dote base de Iniciado en la magia, el Pacto del tomo), todas. Además, Iniciado en la
 * magia puede cambiar uno de sus conjuros por otro del mismo nivel y lista (`optionalReplace`, con `count: 0` si no
 * pide nada más).
 */
export function levelFeatSpellPending(
  gained: FeatWithData[], held: FeatWithData[], levels: LevelEntry[], n: number,
): PendingChoice[] {
  const chosen = heldFeatSpells(levels);
  const late = (f: FeatWithData) =>
    f.ref.key.startsWith("optionalFeature:") || !!f.data?.spellChoices?.some((c) => c.lists);
  const out = [
    ...featSpellPending(gained, (l) => l <= n),
    ...held.flatMap((f) => featSpellPending([f], (l) => l === n || (l < n && !chosen.has(refKey(f.ref)) && late(f)))),
  ];
  for (const f of held) {
    const had = chosen.get(refKey(f.ref));
    if (!SPELL_CHANGE.test(f.ref.key) || !had?.spells.length) continue;
    const source = featSpellsSource(f.ref);
    const asked = out.find((p) => p.source === source);
    if (asked) {
      asked.optionalReplace = true;
      continue;
    }
    // Los filtros de la dote, con la lista elegida (si no se guardó, se vuelve a elegir)
    const parts = f.data?.spellChoices ?? [];
    const lists = parts.find((c) => c.lists)?.lists;
    const withList = (filter: FeatSpellFilter | undefined) =>
      (filter && had.list ? { ...filter, classes: [had.list] } : filter);
    const cantrip = withList(parts.find((c) => c.filter.level === 0)?.filter);
    const spell = withList(parts.find((c) => c.filter.level > 0)?.filter);
    out.push({
      type: "featSpells", source, count: 0, label: `Conjuros de ${f.name}`, optionalReplace: true,
      spells: { class: f.ref, mode: "levelUp", list: "", cantrips: 0, spells: 0, maxLevel: 0 },
      featSpells: {
        feat: f.ref, ...(cantrip ? { cantrip } : {}), ...(spell ? { spell } : {}),
        ...(lists && !had.list ? { lists } : {}),
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
  ctx: {
    path: string; books: string[]; resolve: (ref: Ref) => Promise<CatalogEntry | null>;
    /** Conjuros que conserva de cada dote (`chosenFeatSpells`): de ahí sale el que se cambia. */
    held?: Map<string, Named[]>;
  },
): Promise<{ choices: Choice[]; errors: Record<string, string> }> {
  const errors: Record<string, string> = {};
  const err = (k: string, msg: string) => {
    if (!errors[k]) errors[k] = msg;
  };
  const list = given.filter(isObj);
  if (list.some((c) => !pending.some((p) => p.source === c.source))) err(ctx.path, "Hay elecciones que este nivel no pide.");
  // (las que solo permiten cambiar un conjuro son opcionales)
  const missing = pending.filter((p) => p.count > 0 && !list.some((c) => c.source === p.source));
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
    const r = await checkOne(p, raw.value, load, ctx.held?.get(refKey(p.featSpells.feat)) ?? []);
    if ("error" in r) err(`${ctx.path}.${p.source}`, `${p.label}: ${r.error}`);
    else choices.push({ type: "featSpells", source: p.source, value: r.value });
  }
  return { choices, errors };
}

async function checkOne(
  p: PendingChoice, raw: unknown, load: (v: unknown) => Promise<CatalogEntry | null>, held: Named[],
): Promise<{ error: string } | { value: FeatSpellsValue }> {
  const fs = p.featSpells!;
  if (!isObj(raw)) return { error: "elige los conjuros." };
  // Dote con listas alternativas (Iniciado en la magia base): la elegida hace de lista de los filtros
  let list: string | undefined;
  let { cantrip: cantripFilter, spell: spellFilter } = fs;
  if (fs.lists) {
    if (typeof raw.list !== "string" || !fs.lists.includes(raw.list)) return { error: "elige la lista de conjuros." };
    list = raw.list;
    const classes = [raw.list];
    cantripFilter = cantripFilter && { ...cantripFilter, classes };
    spellFilter = spellFilter && { ...spellFilter, classes };
  } else if (raw.list !== undefined) return { error: "esta dote no deja elegir lista." };
  const pick = async (items: unknown, count: number, filter: FeatSpellFilter | undefined, cantrip: boolean) => {
    const what = cantrip ? (count === 1 ? "truco" : "trucos") : (count === 1 ? "conjuro" : "conjuros");
    const values = items ?? [];
    if (!Array.isArray(values) || values.length !== count) return { error: `elige ${count} ${what}.` };
    const found = await Promise.all(values.map(load));
    if (found.some((e) => !e)) return { error: "conjuro no disponible." };
    const bad = (found as CatalogEntry[]).find((e) => !fitsFeatSpell(e.data as SpellData | null, filter));
    return bad ? { error: `${nameOf(bad)} no se puede elegir con esta dote.` } : (found as CatalogEntry[]);
  };
  const cantrips = await pick(raw.cantrips, p.spells!.cantrips, cantripFilter, true);
  if ("error" in cantrips) return cantrips;
  const spells = await pick(raw.spells, p.spells!.spells, spellFilter, false);
  if ("error" in spells) return spells;
  const chosen = [...cantrips, ...spells];
  if (new Set(chosen.map((e) => refKey(e.ref))).size !== chosen.length) return { error: "conjuro repetido." };
  const ability = raw.ability as Ability | undefined;
  if (fs.abilities ? !fs.abilities.includes(ability as Ability) : ability !== undefined)
    return { error: "elige la característica de lanzamiento." };
  const value: FeatSpellsValue = {
    feat: fs.feat, ...(list ? { list } : {}), cantrips: cantrips.map(toNamed), spells: spells.map(toNamed),
    ...(ability ? { ability } : {}),
  };

  // Cambio de uno de los que ya tiene por otro del mismo nivel que cumpla el filtro de la dote
  if (raw.replace !== undefined) {
    if (!p.optionalReplace || !isObj(raw.replace))
      return { error: "no puedes cambiar conjuros de esta dote en este nivel." };
    const outRef = asRef(raw.replace.out);
    const gone = outRef ? held.find((h) => refKey(h.ref) === refKey(outRef)) : undefined;
    if (!gone) return { error: "solo puedes cambiar uno de los conjuros de la dote." };
    const goneData = (await load(gone.ref))?.data as SpellData | null | undefined;
    const inEntry = await load(raw.replace.in);
    const inData = inEntry?.data as SpellData | null | undefined;
    if (!goneData || !inEntry || !inData) return { error: "conjuro no disponible." };
    if (inData.level !== goneData.level)
      return { error: `${nameOf(inEntry)} no es un conjuro de nivel ${goneData.level}.` };
    const filter = goneData.level === 0 ? cantripFilter : spellFilter;
    if (!fitsFeatSpell(inData, filter && { ...filter, level: goneData.level }))
      return { error: `${nameOf(inEntry)} no se puede elegir con esta dote.` };
    if ([...held, ...value.cantrips, ...value.spells].some((h) => refKey(h.ref) === refKey(inEntry.ref)))
      return { error: `ya tienes ${nameOf(inEntry)}.` };
    value.replace = { out: gone, in: toNamed(inEntry) };
  } else if (p.count === 0 && !list) return { error: "elige el conjuro que cambias." };
  return { value };
}

const toNamed = (e: CatalogEntry): Named => ({ ref: { book: e.ref.book, key: e.ref.key }, name: nameOf(e) });

/**
 * Lo que conserva cada dote en el historial (por `refKey` de la dote): sus conjuros elegidos, con los cambios
 * aplicados en orden, y la lista elegida (Iniciado en la magia base); nada de las que se sustituyeron después.
 */
function heldFeatSpells(levels: LevelEntry[]): Map<string, { spells: Named[]; list?: string }> {
  const out = new Map<string, { spells: Named[]; list?: string }>();
  for (const l of levels) {
    for (const c of l.choices) {
      // Una dote o invocación sustituida (Pacto del tomo cambiado por otro pacto) se lleva sus conjuros: si se vuelve a
      // elegir, sus conjuros son los que se elijan entonces
      if ((c.type === "optionalFeature" || c.type === "feat") && c.replaced) {
        for (const r of c.replaced) out.delete(refKey(r.ref));
      }
      if (c.type !== "featSpells") continue;
      const k = refKey(c.value.feat);
      const prev = out.get(k);
      const spells = [...(prev?.spells ?? []), ...c.value.cantrips, ...c.value.spells];
      const swap = c.value.replace;
      if (swap) {
        const i = spells.findIndex((x) => refKey(x.ref) === refKey(swap.out.ref));
        if (i >= 0) spells.splice(i, 1, swap.in);
      }
      const list = c.value.list ?? prev?.list;
      out.set(k, { spells, ...(list ? { list } : {}) });
    }
  }
  return out;
}

/** Conjuros elegidos con cada dote en el historial (una dote puede dar más en niveles posteriores o cambiarlos). */
export function chosenFeatSpells(levels: LevelEntry[]): Map<string, Named[]> {
  return new Map([...heldFeatSpells(levels)].map(([k, v]) => [k, v.spells]));
}

/**
 * Primer conjuro elegido a la vez con una dote (`featSpells`) y para una clase (`spells`), o con dos dotes, en las
 * elecciones de un mismo nivel. Devuelve la elección de la dote que repite (`source`), el conjuro y la elección de la
 * otra dote (`with`: la anterior en la lista) o null si es contra la clase; null si no hay.
 */
export function featSpellClash(choices: Choice[]): { source: string; name: string; with: string | null } | null {
  const classKeys = new Set(choices.flatMap((c) => (c.type === "spells"
    ? [...c.value.cantrips, ...c.value.spells, ...(c.value.free ?? []), c.value.replace?.in, c.value.replaceCantrip?.in]
    : [])).filter((x): x is Named => !!x).map((x) => refKey(x.ref)));
  // Conjuros ya elegidos por las dotes anteriores, con la elección que los eligió
  const byFeat = new Map<string, string>();
  for (const c of choices) {
    if (c.type !== "featSpells") continue;
    const picked = [...c.value.cantrips, ...c.value.spells, c.value.replace?.in].filter((x): x is Named => !!x);
    for (const x of picked) {
      const k = refKey(x.ref);
      if (classKeys.has(k)) return { source: c.source, name: x.name, with: null };
      const other = byFeat.get(k);
      if (other) return { source: c.source, name: x.name, with: other };
    }
    for (const x of picked) byFeat.set(refKey(x.ref), c.source);
  }
  return null;
}

/** Elecciones que aún no son `featSpells` (las de la clase) y las que sí, de una lista del cliente. */
export function splitFeatSpells(raw: unknown): { rest: unknown; featSpells: unknown[] } {
  if (!Array.isArray(raw)) return { rest: raw, featSpells: [] };
  const isFs = (c: unknown) => isObj(c) && c.type === "featSpells";
  return { rest: raw.filter((c) => !isFs(c)), featSpells: raw.filter(isFs) };
}
