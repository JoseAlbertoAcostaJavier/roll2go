// Validación en el servidor de un nivel nuevo (spec de subir de nivel §4.1): clase, requisitos de multiclase, las
// elecciones que pide exactamente el nivel y los puntos de golpe. Los nombres salen del catálogo, nunca del cliente.
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import {
  ABILITIES, type Ability, type BackgroundData, type ClassData, type FeatData, type FeatureData, type Ref, type SubclassData,
} from "@/lib/rules/types";
import { derive } from "../derive";
import { characterFeats } from "../derive/features";
import { chosenSpells, knownSpellRefs } from "../derive/spells";
import {
  checkFeatSpellChoices, chosenFeatSpells, featSpellClash, levelFeatSpellPending, splitFeatSpells, type FeatWithData,
} from "../spells/featSpells";
import { refKey } from "../sheet/equipmentRefs";
import { heldArcana, heldBonusSpells, heldOptionalFeatures, heldPicks } from "./held";
import { meetsMulticlass, pendingChoices } from "./pendingChoices";
import { currentMasteries } from "./masteries";
import { LEVEL_CHANGED } from "./levelOps";
import { verifyHitDie } from "../creation/rolls";
import type { Dnd2024SheetV2, LevelEntry, Named } from "../sheet/sheet";
import { SUBCLASS_SOURCE, summarizeClasses } from "../sheet/upgrade";
import { checkChoices, loadInto } from "../creation/checkChoices";

export type ValidateLevelCtx = {
  userId: string;
  /** Personaje que sube (la tirada de PG va ligada a él y al nivel). */
  characterId: string;
  books: string[];
  /** Solo resuelve referencias de los libros utilizables. */
  resolve: (ref: Ref) => Promise<CatalogEntry | null>;
  /** Entradas de la hoja (`loadSheetEntries`): clases, subclases, rasgos y dotes actuales. No se modifica. */
  entries: Map<string, CatalogEntry>;
};
export type ValidateLevelResult = { ok: true; entry: LevelEntry } | { ok: false; errors: Record<string, string> };

export const MAX_LEVEL = 20;
const CHOICES_PATH = "choices";
const SUBCLASS_PATH = `${CHOICES_PATH}.${SUBCLASS_SOURCE}`;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const uniq = <T,>(list: T[]) => [...new Set(list)];
// `{ ref: { book, key } }` del cliente → referencia de un tipo y de un libro utilizable
const refOf = (raw: unknown, kind: string, books: string[]): Ref | null => {
  const r = isObj(raw) && isObj(raw.ref) ? raw.ref : null;
  if (!r || typeof r.book !== "string" || typeof r.key !== "string") return null;
  return r.key.startsWith(`${kind}:`) && books.includes(r.book) ? { book: r.book, key: r.key } : null;
};
const named = (e: CatalogEntry): Named => ({ ref: { book: e.ref.book, key: e.ref.key }, name: e.nameEs || e.name });

/** PG medios de un dado de golpe: la mitad redondeada hacia abajo más 1 (d12 → 7). */
export const averageHitDie = (die: number) => Math.floor(die / 2) + 1;

/** Valida el cuerpo `{ expectedLevel, class, choices, hp }` y devuelve la entrada de nivel que se añade al historial. */
export async function validateLevel(
  sheet: Dnd2024SheetV2, input: unknown, ctx: ValidateLevelCtx,
): Promise<ValidateLevelResult> {
  const errors: Record<string, string> = {};
  const err = (path: string, msg: string) => {
    if (!errors[path]) errors[path] = msg;
  };
  const fail = () => ({ ok: false as const, errors });
  if (!isObj(input)) return { ok: false, errors: { level: "Nivel no válido." } };

  const current = sheet.levels.length;
  if (current >= MAX_LEVEL) return { ok: false, errors: { level: `El nivel máximo es ${MAX_LEVEL}.` } };
  if (current === 0) return { ok: false, errors: { level: "El nivel 1 se elige al crear el personaje." } };
  const n = current + 1;
  if (input.expectedLevel !== n) err("expectedLevel", LEVEL_CHANGED);

  // Clase: de un libro utilizable; si es nueva, con los requisitos de multiclase
  const entries = new Map(ctx.entries);
  const classRef = refOf(input.class, "class", ctx.books);
  const classEntry = classRef ? await ctx.resolve(classRef) : null;
  if (!classEntry) {
    err("class", "Clase no disponible.");
    return fail();
  }
  entries.set(refKey(classEntry.ref), classEntry);
  const data = classEntry.data as ClassData;
  const derived = derive(sheet, entries);
  const summary = summarizeClasses(sheet.levels);
  const owned = summary.find((c) => refKey(c.class.ref) === refKey(classEntry.ref));
  const classLevel = (owned?.level ?? 0) + 1;
  if (!owned) {
    const multiclass = meetsMulticlass(sheet, derived, classEntry, entries);
    if (!multiclass.ok) err("class", multiclass.reason);
  }

  // Subclase, si este nivel de clase la da: de esta clase y de un libro utilizable
  const rawChoices = input.choices;
  let subclass: Named | null = null;
  const rawSub = Array.isArray(rawChoices) && classLevel === data.subclassLevel
    ? rawChoices.find((c) => isObj(c) && c.type === "subclass" && c.source === SUBCLASS_SOURCE)
    : undefined;
  if (isObj(rawSub)) {
    const subRef = refOf(rawSub.value, "subclass", ctx.books);
    const subEntry = subRef ? await ctx.resolve(subRef) : null;
    const isChild = !!subEntry?.parent && refKey(subEntry.parent) === refKey(classEntry.ref);
    if (!subEntry || !isChild) err(SUBCLASS_PATH, "La subclase no pertenece a la clase elegida.");
    else {
      subclass = named(subEntry);
      entries.set(refKey(subEntry.ref), subEntry);
    }
  }

  // Lo que pide el nivel: rasgos nuevos de la clase y de la subclase (la elegida ahora o la que ya tiene), y las
  // opciones de estos
  const subRef = subclass?.ref ?? owned?.subclass?.ref;
  if (subRef) await loadInto(entries, [subRef], ctx.resolve);
  const subData = subRef ? (entries.get(refKey(subRef))?.data as SubclassData | undefined) : undefined;
  const newFeatures = [...data.features, ...(subData?.features ?? [])].filter((f) => f.level === classLevel);
  await loadInto(entries, newFeatures.map((f) => f.ref), ctx.resolve);
  const options = newFeatures.flatMap((f) => (entries.get(refKey(f.ref))?.data as FeatureData | undefined)?.options ?? []);
  await loadInto(entries, options, ctx.resolve);
  const pending = pendingChoices(sheet, classEntry.ref, classLevel, entries, {
    ...(subclass ? { subclass: subclass.ref } : {}), known: knownSpellRefs(derived.spells),
  });

  // Al entrar en una clase nueva se ganan sus competencias de multiclase (las maestrías y las dotes ya las tienen en cuenta)
  const gained = owned ? null : data.multiclass?.proficiencies;
  const classData = [...summary.map((c) => entries.get(refKey(c.class.ref))?.data as ClassData | undefined), data];
  // (los conjuros de las dotes, aparte: dependen de las dotes que se eligen ahora)
  const split = splitFeatSpells(rawChoices);
  const checked = await checkChoices(pending, split.rest, {
    path: CHOICES_PATH,
    entries,
    resolve: ctx.resolve,
    skills: derived.skills.filter((s) => s.proficiency > 0).map((s) => s.id),
    expertise: derived.skills.filter((s) => s.proficiency === 2).map((s) => s.id),
    weapons: uniq([...derived.weapons, ...(gained?.weapons ?? [])]),
    level: classLevel,
    subclass,
    subclassPath: SUBCLASS_PATH,
    books: ctx.books,
    character: {
      level: n,
      abilities: Object.fromEntries(ABILITIES.map((a) => [a, derived.abilities[a].score])) as Record<Ability, number>,
      armor: uniq([...derived.armor, ...(gained?.armor ?? [])]),
      spellcasting: classData.some((d) => !!d?.spellcasting),
      feats: derived.features.filter((g) => g.source === "feat").flatMap((g) => g.features.map((f) => f.ref.key)),
    },
    held: heldPicks(sheet.levels),
    masteries: currentMasteries(sheet),
    // Los siempre preparados de esta clase (también los que da este nivel) y los de especie, legado y dotes (los de
    // otra clase sí se pueden aprender: el Hechicero, uno que su subclase de Clérigo le da siempre preparado)
    spellsGranted: [
      ...derived.spells.blocks.filter((b) => [classEntry.ref, subRef].some((r) => r && refKey(r) === refKey(b.class)))
        .flatMap((b) => b.always.map((a) => a.spell.ref)),
      ...derived.spells.other.map((o) => o.spell.ref),
      ...[...(data.spells ?? []), ...(subData?.spells ?? [])].filter((g) => g.level <= classLevel).map((g) => g.ref),
    ],
    // El libro del Mago también tiene los copiados
    spellsHeld: (cls, mode) => {
      const held = chosenSpells(sheet, cls);
      return mode === "spellbook" ? { ...held, spells: [...held.spells, ...(sheet.spellbookExtra ?? [])] } : held;
    },
    arcana: heldArcana(sheet.levels, classEntry.ref),
    bonusHeld: heldBonusSpells(sheet.levels, classEntry.ref),
  });
  for (const [k, msg] of Object.entries(checked.errors)) err(k, msg);

  // Conjuros de dotes e invocaciones (Pacto del tomo): los de las que gana ahora, los que dan más en este nivel las que
  // tenía y el cambio de Iniciado en la magia (las que sustituye ahora ya no cuentan)
  const featOf = (ref: Ref, name: string | null): FeatWithData => {
    const e = entries.get(refKey(ref));
    return { ref, name: name || (e ? e.nameEs || e.name : ref.key), data: e?.data as FeatData | undefined };
  };
  const gainedFeats = checked.choices.flatMap((c) => (c.type === "feat" || c.type === "optionalFeature"
    ? c.value.map((f) => featOf(f.ref, f.name))
    : c.type === "asi" && "feat" in c.value ? [featOf(c.value.feat.ref, c.value.feat.name)] : []));
  const replacedNow = new Set(checked.choices.flatMap((c) =>
    (c.type === "feat" || c.type === "optionalFeature" ? (c.replaced ?? []).map((r) => refKey(r.ref)) : [])));
  const background = entries.get(refKey(sheet.background.ref))?.data as BackgroundData | undefined;
  const heldFeats = [...characterFeats(sheet, background), ...heldOptionalFeatures(sheet.levels)]
    .filter((f) => !replacedNow.has(refKey(f.ref))).map((f) => featOf(f.ref, f.name));
  const featPending = levelFeatSpellPending(gainedFeats, heldFeats, sheet.levels, n);
  const featSpells = await checkFeatSpellChoices(
    featPending, split.featSpells,
    { path: CHOICES_PATH, books: ctx.books, resolve: ctx.resolve, held: chosenFeatSpells(sheet.levels) },
  );
  for (const [k, msg] of Object.entries(featSpells.errors)) err(k, msg);
  // El mismo conjuro no se elige a la vez con una dote y para la clase
  const clash = featSpellClash([...checked.choices, ...featSpells.choices]);
  const clashLabel = clash ? featPending.find((p) => p.source === clash.source)?.label : "";
  if (clash) err(`${CHOICES_PATH}.${clash.source}`, `${clashLabel}: ${clash.name} ya lo eliges con la clase.`);

  // Puntos de golpe: media exacta o tirada firmada; el máximo solo en el nivel 1 de la primera clase (la creación)
  const hp = checkHp(input.hp, data.hitDie, ctx.userId, ctx.characterId, n);
  if ("error" in hp) err("hp", hp.error);

  if (Object.keys(errors).length || "error" in hp) return fail();
  return { ok: true, entry: { n, class: named(classEntry), classLevel, hp, choices: [...checked.choices, ...featSpells.choices] } };
}

function checkHp(
  raw: unknown, die: number, userId: string, characterId: string, n: number,
): LevelEntry["hp"] | { error: string } {
  if (!isObj(raw) || typeof raw.value !== "number") return { error: "Elige cómo ganar los puntos de golpe." };
  const value = raw.value;
  switch (raw.method) {
    case "average":
      return value === averageHitDie(die)
        ? { method: "average", value }
        : { error: `La media del d${die} es ${averageHitDie(die)}.` };
    case "roll":
      return typeof raw.token === "string" && verifyHitDie(userId, { characterId, n, die, value }, raw.token)
        ? { method: "roll", value, token: raw.token }
        : { error: "La tirada no es válida o ha caducado." };
    case "max":
      return { error: "El máximo solo se puede elegir en el nivel 1 de la primera clase." };
    default:
      return { error: "Elige cómo ganar los puntos de golpe." };
  }
}
