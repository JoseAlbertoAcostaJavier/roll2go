// Validación en el servidor de las elecciones de conjuros de un nivel de clase (conjuros de la clase, Arcano místico
// y conjuros fuera de los límites). Parte de `checkChoices`.
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import type { Ref, SpellData } from "@/lib/rules/types";
import { asRef, isObj } from "./rawInput";
import type { PendingChoice } from "../levels/pendingChoices";
import type { BonusSpellsPending } from "../levels/spellPending";
import { refKey } from "../sheet/equipmentRefs";
import type { BonusSpellsValue, Choice, Named, SpellChoice, SpellSwap } from "../sheet/sheet";
import { spellSchoolName } from "../spells/spellTextClient";

export type SpellChoiceMode = NonNullable<PendingChoice["spells"]>["mode"];

/** Lo que ya tiene el personaje y miran las elecciones de conjuros (parte de `ChoicesCtx`). */
export type SpellsHeldCtx = {
  /**
   * Trucos y conjuros que ya tiene una clase lanzadora (aprendidos o, en modo `spellbook`, su libro): no se repiten y
   * de ahí sale el que se sustituye. Sin él (creación), ninguno.
   */
  spellsHeld?: (cls: Ref, mode: SpellChoiceMode) => { cantrips: Named[]; spells: Named[] };
  /** Conjuros que ya tiene por otras vías (siempre preparados, especie, legado, dotes…): tampoco se pueden elegir. */
  spellsGranted?: Ref[];
  /** Conjuros que conserva de cada elección `bonusSpells` (por `source`): de ahí sale el que se sustituye. */
  bonusHeld?: Map<string, Named[]>;
};

export type Load = (v: unknown, kind: string) => Promise<CatalogEntry | null>;
const toNamed = (e: CatalogEntry): Named => ({ ref: { book: e.ref.book, key: e.ref.key }, name: e.nameEs || e.name });

// Sustitución opcional `raw` (`{ out, in }`) de uno de `held` por otro que cumpla `fits` (que recibe también el que
// sale). Sin ella, `swap` vacío
export async function checkSwap(
  raw: unknown, allowed: boolean, held: Named[], load: Load,
  fits: (e: CatalogEntry, gone: Named) => Promise<string | null> | string | null,
): Promise<{ error: string } | { swap?: SpellSwap }> {
  if (raw === undefined) return {};
  if (!allowed || !isObj(raw)) return { error: "no puedes sustituir conjuros en este nivel." };
  const outRef = asRef(raw.out);
  const gone = outRef ? held.find((h) => refKey(h.ref) === refKey(outRef)) : undefined;
  if (!gone) return { error: "solo puedes sustituir uno que ya tienes." };
  const inEntry = await load(raw.in, "spell");
  if (!inEntry?.data) return { error: "conjuro no disponible." };
  const error = await fits(inEntry, gone);
  return error ? { error } : { swap: { out: gone, in: toNamed(inEntry) } };
}

// Conjuros de un rasgo fuera de los límites (Descubrimientos mágicos, Ilusiones mejoradas, Conjuros distintivos):
// exactamente `count`, de sus listas (o de su libro) y del nivel que piden, sin repetir los que ya tiene (tampoco los
// elegidos en este nivel, `earlier`) y, si el nivel lo permite, uno de los que ya da el rasgo sustituido por otro
export async function checkBonusSpells(
  pending: PendingChoice, b: BonusSpellsPending, raw: unknown, earlier: Choice[], ctx: SpellsHeldCtx, load: Load,
): Promise<{ error: string } | { value: BonusSpellsValue }> {
  if (!isObj(raw)) return { error: "elige los conjuros." };
  const nameOf = (e: CatalogEntry) => e.nameEs || e.name;
  const held = ctx.bonusHeld?.get(pending.source) ?? [];
  // Lo elegido para la clase en este mismo nivel (entra en el libro o en los conocidos)
  const levelSpells = earlier.flatMap((c) => (c.type === "spells" && refKey(c.value.class) === refKey(b.class)
    ? [c.value.cantrips, c.value.spells, c.value.free ?? [], [c.value.replace?.in, c.value.replaceCantrip?.in]].flat()
    : [])).filter((n): n is Named => !!n);
  const classHeld = ctx.spellsHeld?.(b.class, b.fromSpellbook ? "spellbook" : "levelUp") ?? { cantrips: [], spells: [] };
  const book = new Set([...classHeld.spells, ...levelSpells].map((n) => refKey(n.ref)));
  // Los del libro pueden ser cualquiera de él; los demás, ninguno que ya tenga
  const taken = new Set([
    ...held.map((h) => refKey(h.ref)),
    ...(b.fromSpellbook ? [] : [
      ...[...classHeld.cantrips, ...classHeld.spells, ...levelSpells].map((n) => refKey(n.ref)),
      ...(ctx.spellsGranted ?? []).map(refKey),
    ]),
  ]);
  const fits = (e: CatalogEntry): string | null => {
    const d = e.data as SpellData | null;
    if (!d) return "conjuro no disponible.";
    if (b.fromSpellbook && !book.has(refKey(e.ref))) return `${nameOf(e)} no está en tu libro de conjuros.`;
    if (!b.fromSpellbook && !d.classes?.some((c) => b.lists.includes(c))) return `${nameOf(e)} no está en una lista permitida.`;
    if (b.cantripsOnly && d.level !== 0) return `${nameOf(e)} no es un truco.`;
    if (b.level !== undefined && d.level !== b.level) return `${nameOf(e)} no es un conjuro de nivel ${b.level}.`;
    if (b.maxLevel !== undefined && d.level > b.maxLevel)
      return `${nameOf(e)} es de nivel ${d.level}; el máximo es ${b.maxLevel}.`;
    return taken.has(refKey(e.ref)) ? `ya tienes ${nameOf(e)}.` : null;
  };

  const items = raw.spells ?? [];
  if (!Array.isArray(items) || items.length !== pending.count) {
    return { error: `elige ${pending.count} ${pending.count === 1 ? "conjuro" : "conjuros"}.` };
  }
  const found = await Promise.all(items.map((v) => load(v, "spell")));
  if (found.some((e) => !e)) return { error: "conjuro no disponible." };
  for (const e of found as CatalogEntry[]) {
    const error = fits(e);
    if (error) return { error };
    taken.add(refKey(e.ref));
  }
  const value: BonusSpellsValue = { spells: (found as CatalogEntry[]).map(toNamed) };
  const swap = await checkSwap(raw.replace, !!pending.optionalReplace, held, load, fits);
  if ("error" in swap) return swap;
  if (swap.swap) value.replace = swap.swap;
  else if (pending.count === 0) return { error: "elige el conjuro que sustituyes." };
  return { value };
}

// Elección de conjuros (spec de conjuros §2.4): exactamente los trucos y conjuros nuevos que pide el nivel, de la
// lista de la clase (los conjuros, también de las de Secretos mágicos: `p.lists`) y de nivel permitido, sin repetir
// los que ya tiene; las entradas gratis del libro del Sabio de la escuela (`p.free`, hasta su número), de su escuela;
// y, si el nivel lo permite, sustituir un conjuro aprendido (`replace`) y un truco (`replaceCantrip`) por otro del
// mismo tipo
export async function checkSpells(
  pending: PendingChoice, p: NonNullable<PendingChoice["spells"]>, raw: unknown, ctx: SpellsHeldCtx, load: Load,
): Promise<{ error: string } | { value: SpellChoice }> {
  if (!isObj(raw)) return { error: "elige los conjuros." };
  const given = asRef(raw.class);
  if (given && refKey(given) !== refKey(p.class)) return { error: "conjuros de otra clase." };
  const held = ctx.spellsHeld?.(p.class, p.mode) ?? { cantrips: [], spells: [] };
  const heldKeys = new Set([...held.cantrips, ...held.spells].map((h) => refKey(h.ref)));
  for (const r of ctx.spellsGranted ?? []) heldKeys.add(refKey(r));
  const nameOf = (e: CatalogEntry) => e.nameEs || e.name;
  // Comprueba un conjuro: de la lista, truco o de nivel 1..máximo
  const fits = (e: CatalogEntry, cantrip: boolean): string | null => {
    const d = e.data as SpellData | null;
    const lists = cantrip ? [p.list] : (p.lists ?? [p.list]);
    if (!d?.classes?.some((c) => lists.includes(c))) return `${nameOf(e)} no está en la lista de la clase.`;
    if (cantrip ? d.level !== 0 : d.level < 1) return `${nameOf(e)} no es ${cantrip ? "un truco" : "un conjuro de nivel 1 o más"}.`;
    if (!cantrip && d.level > p.maxLevel) return `${nameOf(e)} es de nivel ${d.level}; el máximo es ${p.maxLevel}.`;
    return null;
  };
  const pick = async (list: unknown, count: number, cantrip: boolean): Promise<{ error: string } | CatalogEntry[]> => {
    const what = cantrip ? (count === 1 ? "truco" : "trucos") : (count === 1 ? "conjuro" : "conjuros");
    const items = list ?? [];
    if (!Array.isArray(items) || items.length !== count) return { error: `elige ${count} ${what}.` };
    const found = await Promise.all(items.map((v) => load(v, "spell")));
    if (found.some((e) => !e)) return { error: "conjuro no disponible." };
    for (const e of found as CatalogEntry[]) {
      const bad = fits(e, cantrip);
      if (bad) return { error: bad };
      if (heldKeys.has(refKey(e.ref))) return { error: `ya tienes ${nameOf(e)}.` };
    }
    return found as CatalogEntry[];
  };

  const cantrips = await pick(raw.cantrips, p.cantrips, true);
  if ("error" in cantrips) return cantrips;
  const spells = await pick(raw.spells, p.spells, false);
  if ("error" in spells) return spells;
  // Sabio de la escuela: de la lista de la clase, de su escuela y de nivel 1..su máximo
  let free: CatalogEntry[] = [];
  if (p.free) {
    const f = p.free;
    const school = spellSchoolName(f.school);
    const items = raw.free ?? [];
    // («puedes añadir»: de 0 a `count`)
    if (!Array.isArray(items) || items.length > f.count)
      return { error: `elige hasta ${f.count} ${f.count === 1 ? "conjuro gratis" : "conjuros gratis"} de ${school}.` };
    const found = await Promise.all(items.map((v) => load(v, "spell")));
    if (found.some((e) => !e)) return { error: "conjuro no disponible." };
    for (const e of found as CatalogEntry[]) {
      const d = e.data as SpellData | null;
      if (!d?.classes?.includes(p.list)) return { error: `${nameOf(e)} no está en la lista de la clase.` };
      if (d.school !== f.school) return { error: `${nameOf(e)} no es de ${school}.` };
      if (d.level < 1 || d.level > f.maxLevel)
        return { error: `${nameOf(e)} no es un conjuro de nivel 1 a ${f.maxLevel}.` };
      if (heldKeys.has(refKey(e.ref))) return { error: `ya tienes ${nameOf(e)}.` };
    }
    free = found as CatalogEntry[];
  }
  const chosen = [...cantrips, ...spells, ...free];
  if (new Set(chosen.map((e) => refKey(e.ref))).size !== chosen.length) return { error: "conjuro repetido." };

  const value: SpellChoice = {
    class: p.class, cantrips: cantrips.map(toNamed), spells: spells.map(toNamed),
    ...(p.free ? { free: free.map(toNamed) } : {}),
  };
  // Sustituciones: un conjuro aprendido (solo `levelUp`: nunca sale uno del libro del Mago) y un truco
  const swaps = [
    { field: "replace", cantrip: false, allowed: !!pending.optionalReplace && p.mode === "levelUp", from: held.spells },
    { field: "replaceCantrip", cantrip: true, allowed: !!pending.optionalReplaceCantrip, from: held.cantrips },
  ] as const;
  for (const s of swaps) {
    const rawSwap = raw[s.field];
    if (rawSwap === undefined) continue;
    if (!s.allowed || !isObj(rawSwap)) return { error: `no puedes sustituir ${s.cantrip ? "trucos" : "conjuros"} en este nivel.` };
    const outRef = asRef(rawSwap.out);
    const out = outRef ? s.from.find((h) => refKey(h.ref) === refKey(outRef)) : undefined;
    if (!out) return { error: `solo puedes sustituir ${s.cantrip ? "un truco" : "un conjuro"} que ya conoces.` };
    const inEntry = await load(rawSwap.in, "spell");
    if (!inEntry) return { error: "conjuro no disponible." };
    const bad = fits(inEntry, s.cantrip);
    if (bad) return { error: bad };
    if (heldKeys.has(refKey(inEntry.ref)) || chosen.some((e) => refKey(e.ref) === refKey(inEntry.ref)))
      return { error: `ya tienes ${nameOf(inEntry)}.` };
    chosen.push(inEntry);
    value[s.field] = { out, in: toNamed(inEntry) };
  }
  return { value };
}
