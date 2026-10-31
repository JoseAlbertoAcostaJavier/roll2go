// Validación en el servidor de las elecciones de un nivel de clase (al crear y al subir de nivel): exactamente las
// pendientes y cada una válida. Los nombres salen del catálogo, nunca del cliente.
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import {
  ABILITIES, type Ability, type FeatData, type ItemData, type OptionalFeatureData, type Ref, type SpellData,
} from "@/lib/rules/types";
import { checkBonusSpells, checkSpells, checkSwap, type SpellsHeldCtx } from "./checkSpells";
import { asRef, has, isObj, isStringList, type Obj } from "./rawInput";
import { weaponProficient } from "../derive/attacks";
import { FEATURE_OPTION_LABELS } from "../levels/featureChoices";
import { ABILITY_NAMES, SKILL_NAMES, featFitsCategories } from "../sheet/labels";
import {
  meetsFeatPrerequisite, withBonusCantrips, type FeatPrerequisiteCtx, type PendingChoice,
} from "../levels/pendingChoices";
import { meleeOnlySource, validateMasteries } from "../levels/masteries";
import { bareName, refKey } from "../sheet/equipmentRefs";
import type { Choice, Named } from "../sheet/sheet";

/** Carga en `entries` las referencias que aún no están (las que no existen o no se pueden usar quedan fuera). */
export async function loadInto(
  entries: Map<string, CatalogEntry>, refs: Ref[], resolve: (ref: Ref) => Promise<CatalogEntry | null>,
): Promise<void> {
  const found = await Promise.all(refs.filter((r) => !entries.has(refKey(r))).map((r) => resolve(r)));
  for (const e of found) if (e) entries.set(refKey(e.ref), e);
}

export type ChoicesCtx = SpellsHeldCtx & {
  /** Prefijo de los errores: `<path>` (falta o sobra alguna) y `<path>.<source>` (una mal elegida). */
  path: string;
  /** Entradas ya cargadas (la clase, sus rasgos y sus opciones); se añaden las que se resuelven aquí. */
  entries: Map<string, CatalogEntry>;
  /** Solo resuelve referencias de los libros utilizables. */
  resolve: (ref: Ref) => Promise<CatalogEntry | null>;
  /** Habilidades con competencia antes de estas elecciones: no se pueden volver a elegir. */
  skills: string[];
  /** Competencias con armas (para las maestrías). */
  weapons: string[];
  /** Nivel de clase (para los prerrequisitos de los rasgos opcionales). */
  level: number;
  /** Subclase elegida en este nivel (se valida aparte; aquí solo se exige si el nivel la pide). */
  subclass: Named | null;
  /** Ruta del error si falta la subclase (por defecto, la del creador). */
  subclassPath?: string;
  /** Si se da, solo se aceptan referencias de estos libros (además de las opciones escritas a mano). */
  books?: string[];
  /** Habilidades con pericia antes de estas elecciones. */
  expertise?: string[];
  /**
   * Personaje al subir de nivel: nivel total tras el nuevo, características actuales y claves de sus dotes. Sin él
   * (creación) no se comprueban prerrequisitos de dotes ni se puede elegir una mejora de característica.
   */
  character?: FeatPrerequisiteCtx & { feats: string[] };
  /** Dotes y rasgos opcionales que conserva de cada elección (`heldPicks`): no se repiten y se pueden sustituir. */
  held?: Map<string, Named[]>;
  /** Armas con las que ya tiene maestría. */
  masteries?: Ref[];
  /** Arcanos (Arcano místico) que ya tiene la clase: no se repiten y de ahí sale el que se sustituye. */
  arcana?: Named[];
};

const lower = (s: string) => s.toLowerCase();
const ABILITY_CAP = 20;
const EPIC_CAP = 30;
const ASI_POINTS = 2;
// La dote «Ability Score Improvement» es la propia mejora: se elige en la otra pestaña
const ASI_FEAT = "feat:ability score improvement|";

/**
 * Comprueba que `raw` trae exactamente las elecciones pendientes (ni más ni menos) y que cada una es válida. Devuelve
 * las elecciones con los nombres del catálogo, en el orden de `pending`.
 */
export async function checkChoices(
  pending: PendingChoice[], raw: unknown, ctx: ChoicesCtx,
): Promise<{ choices: Choice[]; errors: Record<string, string> }> {
  const errors: Record<string, string> = {};
  const err = (key: string, msg: string) => {
    if (!errors[key]) errors[key] = msg;
  };
  const list = raw ?? [];
  if (!Array.isArray(list) || !list.every((c) => isObj(c) && typeof c.type === "string" && typeof c.source === "string")) {
    err(ctx.path, "Elecciones de clase no válidas.");
    return { choices: [], errors };
  }
  const given = list as Obj[];
  const matches = (p: PendingChoice, c: Obj) => c.type === p.type && c.source === p.source;
  if (given.some((c) => !pending.some((p) => matches(p, c)))) err(ctx.path, "Hay elecciones que este nivel no pide.");
  if (pending.some((p) => given.filter((c) => matches(p, c)).length > 1)) err(ctx.path, "Hay elecciones repetidas.");
  const missing = pending.filter((p) => p.type !== "subclass" && p.count > 0 && !given.some((c) => matches(p, c)));
  if (missing.length) err(ctx.path, `Falta elegir: ${missing.map((p) => p.label).join(", ")}.`);

  // Busca una entrada del tipo `kind` en las cargadas o en los libros utilizables
  const load = async (v: unknown, kind: string): Promise<CatalogEntry | null> => {
    const ref = asRef(v);
    if (!ref || !ref.key.startsWith(`${kind}:`) || (ctx.books && !ctx.books.includes(ref.book))) return null;
    const e = ctx.entries.get(refKey(ref)) ?? (await ctx.resolve(ref));
    if (e) ctx.entries.set(refKey(e.ref), e);
    return e;
  };
  const named = (e: CatalogEntry): Named => ({ ref: { book: e.ref.book, key: e.ref.key }, name: e.nameEs || e.name });

  const proficient = ctx.skills.map(lower);
  const expertise: string[] = (ctx.expertise ?? []).map(lower);
  // Características que ya suben en este nivel (para el tope)
  const raised: Partial<Record<Ability, number>> = {};
  const scoreOf = (a: Ability) => (ctx.character?.abilities[a] ?? 0) + (raised[a] ?? 0);
  const raise = (a: Ability, v: number) => { raised[a] = (raised[a] ?? 0) + v; };

  // Dote elegida: prerrequisitos, repetición y la característica que sube (si la dote da +1). Devuelve el error o la
  // característica elegida
  const checkFeat = (e: CatalogEntry, rawAbility: unknown): { error: string } | { ability?: Ability } => {
    const d = e.data as FeatData | null;
    const name = e.nameEs || e.name;
    if (ctx.character && !meetsFeatPrerequisite(d?.prerequisite, ctx.character)) {
      return { error: `no cumples los requisitos de ${name}.` };
    }
    if (ctx.character && !d?.repeatable && ctx.character.feats.includes(e.ref.key)) return { error: `ya tienes ${name}.` };
    const from = d?.abilityIncrease ?? [];
    if (!from.length) return rawAbility === undefined ? {} : { error: `${name} no mejora ninguna característica.` };
    const ability = (rawAbility ?? (from.length === 1 ? from[0] : undefined)) as Ability;
    if (!from.includes(ability)) return { error: `elige qué característica mejora ${name}.` };
    const cap = d?.category === "epicBoon" ? EPIC_CAP : ABILITY_CAP;
    if (ctx.character && scoreOf(ability) + 1 > cap) return { error: `${ABILITY_NAMES[ability]} no puede pasar de ${cap}.` };
    raise(ability, 1);
    return { ability };
  };
  // Lo que sustituye (`replaced`): como mucho uno de los que conserva de esta misma elección, si la elección lo permite
  const replacedOf = (p: PendingChoice, c: Obj): Named[] | null => {
    if (c.replaced === undefined) return [];
    const held = ctx.held?.get(p.source) ?? [];
    const refs = Array.isArray(c.replaced) ? c.replaced.map(asRef) : [null];
    if (!p.optionalReplace || refs.length > 1 || refs.some((r) => !r)) return null;
    const found = (refs as Ref[]).map((r) => held.find((h) => refKey(h.ref) === refKey(r)));
    return found.every(Boolean) ? (found as Named[]) : null;
  };
  // La primera elegida que ya tiene (sin contar las que sustituye, que tampoco pueden volver a elegirse)
  const alreadyHeld = (p: PendingChoice, picked: CatalogEntry[]) => {
    const held = new Set((ctx.held?.get(p.source) ?? []).map((h) => refKey(h.ref)));
    return picked.find((e) => held.has(refKey(e.ref)));
  };

  const out: Choice[] = [];
  for (const p of pending) {
    if (p.type === "subclass") {
      if (!ctx.subclass) err(ctx.subclassPath ?? "classes.0.subclass", "Elige una subclase.");
      else out.push({ type: "subclass", source: p.source, value: ctx.subclass });
      continue;
    }
    const c = given.find((g) => matches(p, g));
    if (!c) continue;
    const bad = (msg: string) => err(`${ctx.path}.${p.source}`, `${p.label}: ${msg}`);
    const value = c.value;
    const chooseN = `elige ${p.count}.`;

    if (p.type === "skills" || p.type === "expertise") {
      if (!isStringList(value) || value.length !== p.count) { bad(chooseN); continue; }
      // Sin lista: cualquier habilidad (la pericia, cualquiera con competencia, que se comprueba abajo)
      const from = p.from?.map(lower) ?? (p.type === "skills" ? Object.keys(SKILL_NAMES) : undefined);
      if (from && !value.every((s) => from.includes(lower(s)))) { bad("alguna no está en la lista."); continue; }
      if (p.type === "skills") {
        if (value.some((s) => proficient.includes(lower(s)))) { bad("repites una habilidad que ya tienes."); continue; }
        proficient.push(...value.map(lower));
      } else {
        if (!value.every((s) => proficient.includes(lower(s)))) { bad("solo en habilidades con competencia."); continue; }
        if (value.some((s) => expertise.includes(lower(s)))) { bad("ya tienes pericia en esa habilidad."); continue; }
        expertise.push(...value.map(lower));
      }
      out.push({ type: p.type, source: p.source, value });
    } else if (p.type === "featureOption") {
      const ref = asRef(value);
      if (p.options?.length) {
        const listed = !!ref && p.options.some((o) => o.book === ref.book && o.key === ref.key);
        const e = listed ? await load(ref, ref!.key.split(":")[0]) : null;
        if (!e) { bad("elige una de las opciones."); continue; }
        out.push({ type: "featureOption", source: p.source, value: named(e) });
      } else {
        // Opciones escritas a mano: `{ book: "builtin", key: "option:…" }`
        const key = ref?.book === "builtin" ? ref.key : "";
        if (!p.from?.includes(key) || !FEATURE_OPTION_LABELS[key]) { bad("elige una de las opciones."); continue; }
        out.push({ type: "featureOption", source: p.source, value: { ref: { book: "builtin", key }, name: FEATURE_OPTION_LABELS[key] } });
      }
    } else if (p.type === "feat") {
      const replaced = replacedOf(p, c);
      if (!replaced) { bad("no puedes sustituir esa dote."); continue; }
      const list: unknown[] = Array.isArray(value) ? value : [];
      const picked = await Promise.all(list.map((v) => load(v, "feat")));
      if (picked.length !== p.count + replaced.length || picked.some((e) => !e)) { bad(chooseN); continue; }
      const feats = picked as CatalogEntry[];
      // (una entrada sin datos válidos cuenta como de otra categoría)
      if (feats.some((e) => !featFitsCategories(e.data as FeatData | null, p.category))) { bad("dote de otra categoría."); continue; }
      if (new Set(feats.map((e) => refKey(e.ref))).size !== feats.length) { bad("dote repetida."); continue; }
      const held = alreadyHeld(p, feats);
      if (held) { bad(`ya tienes ${held.nameEs || held.name}.`); continue; }
      const checked = feats.map((e, k) => checkFeat(e, isObj(list[k]) ? list[k].ability : undefined));
      const failed = checked.find((r): r is { error: string } => "error" in r);
      if (failed) { bad(failed.error); continue; }
      const featValue = feats.map((e, k) => {
        const ability = (checked[k] as { ability?: Ability }).ability;
        return { ...named(e), ...(ability ? { ability } : {}) };
      });
      out.push({ type: "feat", source: p.source, value: featValue, ...(replaced.length ? { replaced } : {}) });
    } else if (p.type === "asi") {
      if (!ctx.character || !isObj(value)) { bad("elige una mejora."); continue; }
      if (isObj(value.abilities) && Object.keys(value).length === 1) {
        // +2 a una característica o +1 a dos, sin pasar de 20
        const parsed = Object.entries(value.abilities) as [Ability, number][];
        const valid = parsed.every(([a, v]) => ABILITIES.includes(a) && (v === 1 || v === 2))
          && parsed.reduce((sum, [, v]) => sum + v, 0) === ASI_POINTS;
        if (!valid) { bad("+2 a una característica o +1 a dos."); continue; }
        const over = parsed.find(([a, v]) => scoreOf(a) + v > ABILITY_CAP);
        if (over) { bad(`${ABILITY_NAMES[over[0]]} no puede pasar de ${ABILITY_CAP}.`); continue; }
        for (const [a, v] of parsed) raise(a, v);
        const abilities = Object.fromEntries(parsed) as Partial<Record<Ability, 1 | 2>>;
        out.push({ type: "asi", source: p.source, value: { abilities } });
      } else if (has(value, "feat") && Object.keys(value).every((k) => k === "feat" || k === "ability")) {
        const e = await load(value.feat, "feat");
        if (!e || e.ref.key.startsWith(ASI_FEAT)) { bad("elige una dote."); continue; }
        if (!featFitsCategories(e.data as FeatData | null, p.category)) { bad("dote de otra categoría."); continue; }
        const r = checkFeat(e, value.ability);
        if ("error" in r) { bad(r.error); continue; }
        out.push({ type: "asi", source: p.source, value: { feat: named(e), ...(r.ability ? { ability: r.ability } : {}) } });
      } else bad("elige una mejora.");
    } else if (p.type === "optionalFeature") {
      const replaced = replacedOf(p, c);
      if (!replaced) { bad("no puedes sustituir esa opción."); continue; }
      const picked = Array.isArray(value) ? await Promise.all(value.map((v) => load(v, "optionalFeature"))) : [];
      if (picked.length !== p.count + replaced.length || picked.some((e) => !e)) { bad(chooseN); continue; }
      const opts = picked as CatalogEntry[];
      const keys = opts.map((e) => e.ref.key);
      if (new Set(keys).size !== keys.length) { bad("opción repetida."); continue; }
      const held = alreadyHeld(p, opts);
      if (held) { bad(`ya tienes ${held.nameEs || held.name}.`); continue; }
      // Los prerrequisitos de pacto o de otro rasgo se cumplen con las elegidas o con las que conserva
      const gone = replaced.map((r) => r.ref.key);
      const have = [...keys, ...(ctx.held?.get(p.source) ?? []).map((h) => h.ref.key).filter((k) => !gone.includes(k))];
      const unmet = opts.find((e) => {
        const d = e.data as OptionalFeatureData | null;
        const pre = d?.prerequisite;
        return !d?.featureType?.some((t) => p.featureType?.includes(t)) || (pre?.level ?? 0) > ctx.level
          || (!!pre?.pact && !have.includes(pre.pact)) || (!!pre?.feature && !have.includes(pre.feature));
      });
      if (unmet) { bad(`no cumples los requisitos de ${unmet.nameEs || unmet.name}.`); continue; }
      out.push({ type: "optionalFeature", source: p.source, value: opts.map(named), ...(replaced.length ? { replaced } : {}) });
    } else if (p.type === "weaponMastery") {
      const refs = Array.isArray(value) ? value.map(asRef) : [];
      if (refs.some((r) => !r)) { bad(chooseN); continue; }
      const weapons = refs as Ref[];
      await loadInto(ctx.entries, weapons.filter((r) => r.key.startsWith("item:")), ctx.resolve);
      const checked = validateMasteries(weapons, {
        allowed: p.count,
        entries: ctx.entries,
        meleeOnly: meleeOnlySource(p.source),
        proficientWith: (item) => weaponProficient(item.data as ItemData, [item.name, bareName(item.ref.key)], ctx.weapons),
      });
      if (!checked.ok) { bad(checked.error); continue; }
      const repeated = weapons.find((w) => ctx.masteries?.some((m) => refKey(m) === refKey(w)));
      if (repeated) {
        const e = ctx.entries.get(refKey(repeated));
        bad(`ya tienes maestría con ${e ? e.nameEs || e.name : "esa arma"}.`);
        continue;
      }
      out.push({ type: "weaponMastery", source: p.source, value: weapons });
    } else if (p.type === "spells" && p.spells) {
      // Con los trucos de más de las opciones de rasgo de este nivel, que ya están comprobadas (van antes)
      const options = out.flatMap((o) => (o.type === "featureOption" ? [o.value.ref.key] : []));
      const [withBonus] = withBonusCantrips([p], options);
      const r = await checkSpells(withBonus, withBonus.spells!, value, ctx, load);
      if ("error" in r) { bad(r.error); continue; }
      out.push({ type: "spells", source: p.source, value: r.value });
    } else if (p.type === "arcanum" && p.arcanum) {
      // Arcano místico: un conjuro de la lista de la clase del nivel exacto, que no tenga ya por otra vía, y (si el
      // nivel lo permite) uno de los que tiene sustituido por otro de la lista del mismo nivel
      const arcana = ctx.arcana ?? [];
      const taken = new Set([...arcana.map((a) => a.ref), ...(ctx.spellsGranted ?? [])].map(refKey));
      const fitsArcanum = (e: CatalogEntry, level: number): string | null => {
        const d = e.data as SpellData | null;
        const name = e.nameEs || e.name;
        if (!d?.classes?.includes(p.arcanum!.list)) return `${name} no está en la lista de la clase.`;
        if (d.level !== level) return `${name} no es un conjuro de nivel ${level}.`;
        return taken.has(refKey(e.ref)) ? `ya tienes ${name}.` : null;
      };
      let arcanum: Named | null = null;
      if (p.count > 0) {
        const e = await load(value, "spell");
        if (!e?.data) { bad("elige un conjuro."); continue; }
        const error = fitsArcanum(e, p.arcanum.level ?? 0);
        if (error) { bad(error); continue; }
        arcanum = named(e);
        taken.add(refKey(e.ref));
      } else if (value !== null && value !== undefined) {
        bad("en este nivel solo puedes sustituir un arcano.");
        continue;
      }
      const swap = await checkSwap(c.replace, !!p.optionalReplace, arcana, load, async (e, gone) => {
        const goneData = (await load(gone.ref, "spell"))?.data as SpellData | null | undefined;
        return goneData ? fitsArcanum(e, goneData.level) : "conjuro no disponible.";
      });
      if ("error" in swap) { bad(swap.error); continue; }
      if (p.count === 0 && !swap.swap) { bad("elige el arcano que sustituyes."); continue; }
      out.push({ type: "arcanum", source: p.source, value: arcanum, ...(swap.swap ? { replace: swap.swap } : {}) });
    } else if (p.type === "bonusSpells" && p.bonusSpells) {
      const r = await checkBonusSpells(p, p.bonusSpells, value, out, ctx, load);
      if ("error" in r) { bad(r.error); continue; }
      out.push({ type: "bonusSpells", source: p.source, value: r.value });
    } else {
      bad("esta elección todavía no se puede hacer aquí.");
    }
  }
  return { choices: out, errors };
}
