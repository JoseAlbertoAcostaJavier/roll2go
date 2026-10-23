// Qué toca elegir al ganar un nivel de clase (spec de subir de nivel §3) y requisitos de multiclase (§4.2). Funciones
// puras: las usan el asistente de subir de nivel, el creador (nivel 1) y la validación del servidor.
import type { CatalogEntry } from "@/lib/rules/catalog";
import type { Ability, ClassData, FeatureData, LevelCounts, LevelFeature, Ref, SubclassData } from "@/lib/rules/types";
import type { Derived } from "./derive";
import { refKey } from "./equipmentRefs";
import { FEATURE_CHOICES, type ChoiceSpec } from "./featureChoices";
import { ABILITY_NAMES } from "./labels";
import type { Choice, Dnd2024SheetV2 } from "./sheet";
import { SKILLS_SOURCE, SUBCLASS_SOURCE, summarizeClasses } from "./upgrade";

/**
 * Elección que pide un nivel. `source` es la clave del rasgo o de la progresión (la misma que lleva la `Choice`):
 * `classFeature:…`, `progression:metamagic|sorcerer|xphb`, `class:skills`, `class:subclass`, `multiclass:ranger|xphb`.
 * `from`: habilidades permitidas o nombres de las opciones escritas a mano; `options`: opciones del catálogo;
 * `category`: categorías de dote (`FS`, `EB`, `G`); `featureType`: tipo de rasgo opcional (`MM`, `EI`…);
 * `optionalReplace`: además puede sustituir uno de los rasgos opcionales que ya conoce.
 */
export type PendingChoice = {
  type: Choice["type"];
  source: string;
  count: number;
  from?: string[];
  options?: Ref[];
  category?: string[];
  featureType?: string[];
  label: string;
  optionalReplace?: boolean;
};

const ASI_PREFIX = "classFeature:ability score improvement|";
// Categoría de las dotes generales (la alternativa a la mejora de característica)
const GENERAL_FEATS = ["G"];

const FEAT_LABELS: Record<string, string> = { FS: "Estilo de combate", EB: "Don épico", G: "Dote general" };
const OPTIONAL_LABELS: Record<string, string> = {
  Metamagic: "Metamagia",
  "Eldritch Invocations": "Invocaciones sobrenaturales",
  Maneuvers: "Maniobras",
};

/** Número acumulado en un nivel: el del mayor nivel de la progresión que no lo supera. */
function countAt(counts: LevelCounts | null | undefined, level: number): number {
  let best = 0;
  let value = 0;
  for (const [l, n] of Object.entries(counts ?? {})) {
    if (Number(l) <= level && Number(l) >= best) [best, value] = [Number(l), n];
  }
  return value;
}

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
// "classFeature:primal knowledge|barbarian|xphb|3" → "Primal knowledge"
const nameFromKey = (key: string) => capitalize(key.replace(/^[^:]*:/, "").split("|")[0]);
// "class:barbarian|xphb" → "barbarian|xphb"
const bareKey = (key: string) => key.replace(/^[^:]*:/, "");

/**
 * Elecciones que pide el nivel `newClassLevel` de la clase `classRef` (reglas 1–9 de la spec §3). `sheet` es la hoja
 * antes de ese nivel: para el nivel 1 del personaje (crear o rehacer la creación), con `levels` vacío. En el nivel en
 * que se gana la subclase, `opts.subclass` es la elegida, para pedir también lo que da su primer rasgo.
 */
export function pendingChoices(
  sheet: Dnd2024SheetV2,
  classRef: Ref,
  newClassLevel: number,
  entries: Map<string, CatalogEntry>,
  opts: { subclass?: Ref } = {},
): PendingChoice[] {
  const data = entries.get(refKey(classRef))?.data as ClassData | undefined;
  if (!data) return [];
  const entryOf = (r: Ref) => entries.get(refKey(r));
  const nameOf = (r: Ref) => {
    const e = entryOf(r);
    return e ? (e.nameEs ?? e.name) : nameFromKey(r.key);
  };
  const owned = summarizeClasses(sheet.levels).find((c) => refKey(c.class.ref) === refKey(classRef));
  const subclassRef = opts.subclass ?? owned?.subclass?.ref ?? null;
  const subclass = subclassRef ? entryOf(subclassRef) : undefined;
  const subData = subclass?.data as SubclassData | undefined;
  const out: PendingChoice[] = [];

  // Habilidades de nivel 1: las de la clase si es la primera; las de multiclase si se entra en otra
  if (newClassLevel === 1 && sheet.levels.length === 0 && data.skills.count > 0) {
    out.push({ type: "skills", source: SKILLS_SOURCE, count: data.skills.count, from: data.skills.from, label: "Habilidades de clase" });
  } else if (newClassLevel === 1 && sheet.levels.length > 0 && data.multiclass?.proficiencies.skills) {
    const { count, from } = data.multiclass.proficiencies.skills;
    out.push({ type: "skills", source: `multiclass:${bareKey(classRef.key)}`, count, from, label: "Habilidades de multiclase" });
  }

  // 1. Subclase
  if (newClassLevel === data.subclassLevel) {
    out.push({ type: "subclass", source: SUBCLASS_SOURCE, count: 1, label: data.subclassTitle || "Subclase" });
  }

  const newFeatures = data.features.filter((f) => f.level === newClassLevel);

  // 2. Mejora de característica (o una dote general)
  const asi = newFeatures.find((f) => f.ref.key.startsWith(ASI_PREFIX) || (entryOf(f.ref)?.data as FeatureData)?.asi);
  if (asi) {
    out.push({ type: "asi", source: asi.ref.key, count: 1, category: GENERAL_FEATS, label: "Mejora de característica" });
  }

  // 3 y 4. Dotes y rasgos opcionales de las progresiones de la clase y de su subclase (por nivel de clase)
  const owners = [
    { bare: bareKey(classRef.key), progressions: data.progressions },
    ...(subclass && subData ? [{ bare: bareKey(subclass.ref.key), progressions: subData.progressions }] : []),
  ];
  for (const { bare, progressions } of owners) {
    for (const p of progressions.feats) {
      const count = countAt(p.levels, newClassLevel) - countAt(p.levels, newClassLevel - 1);
      if (count <= 0) continue;
      out.push({
        type: "feat", source: `progression:${p.category.join(",").toLowerCase()}|${bare}`, count, category: p.category,
        label: FEAT_LABELS[p.category[0]] ?? "Dote",
      });
    }
    for (const p of progressions.optionalFeatures) {
      const known = countAt(p.levels, newClassLevel - 1);
      const count = countAt(p.levels, newClassLevel) - known;
      if (count <= 0) continue;
      out.push({
        type: "optionalFeature", source: `progression:${p.name.toLowerCase()}|${bare}`, count, featureType: p.featureType,
        label: OPTIONAL_LABELS[p.name] ?? p.name, optionalReplace: known > 0,
      });
    }
  }

  // 5. Maestrías con armas
  const masteries = countAt(data.progressions.weaponMastery, newClassLevel)
    - countAt(data.progressions.weaponMastery, newClassLevel - 1);
  if (masteries > 0) {
    out.push({
      type: "weaponMastery", source: `progression:weapon mastery|${bareKey(classRef.key)}`, count: masteries,
      label: "Maestría con armas",
    });
  }

  // 6 y 7. Opciones de rasgo y elecciones escritas a mano de los rasgos nuevos de la clase
  // («… Options» con rasgos opcionales ya los pide su progresión)
  const hasOptionalProgression = owners.some((o) => o.progressions.optionalFeatures.length > 0);
  const featureChoices = (features: LevelFeature[]) => {
    for (const f of features) {
      const fData = entryOf(f.ref)?.data as (FeatureData & { choices?: ChoiceSpec[] }) | undefined;
      const options = fData?.options ?? [];
      const coveredByProgression = hasOptionalProgression && options.every((o) => o.key.startsWith("optionalFeature:"));
      if (options.length > 0 && !coveredByProgression) {
        out.push({ type: "featureOption", source: f.ref.key, count: 1, options, label: nameOf(f.ref) });
      }
      for (const spec of FEATURE_CHOICES[f.ref.key] ?? fData?.choices ?? []) {
        out.push({
          type: spec.type, source: f.ref.key, count: spec.count, ...(spec.from ? { from: spec.from } : {}),
          label: nameOf(f.ref),
        });
      }
    }
  };
  featureChoices(newFeatures);

  // 8. Conjuros: llegan con la parte 5

  // 9. Rasgos nuevos de la subclase
  if (subData) featureChoices(subData.features.filter((f) => f.level === newClassLevel));

  return out;
}

/**
 * Requisito de multiclase (13 o más en la característica principal de cada clase actual y de la nueva; con `any`,
 * basta una de las alternativas). Subir en una clase que ya tiene no lo exige.
 */
export function meetsMulticlass(
  sheet: Dnd2024SheetV2,
  derived: Derived,
  newClass: CatalogEntry,
  entries: Map<string, CatalogEntry>,
): { ok: true } | { ok: false; reason: string } {
  const current = summarizeClasses(sheet.levels).map((c) => c.class.ref);
  if (current.some((r) => refKey(r) === refKey(newClass.ref))) return { ok: true };

  const missing: string[] = [];
  const classes = [...current.map((r) => entries.get(refKey(r))?.data), newClass.data] as (ClassData | undefined)[];
  for (const data of classes) {
    const req = data?.multiclass?.requirements;
    if (!req?.abilities.length) continue;
    const low = req.abilities.filter((a) => derived.abilities[a].score < 13);
    if (req.any ? low.length < req.abilities.length : low.length === 0) continue;
    const text = (req.any ? req.abilities : low).map((a: Ability) => `13 en ${ABILITY_NAMES[a]}`).join(req.any ? " o " : " y ");
    if (!missing.includes(text)) missing.push(text);
  }
  return missing.length ? { ok: false, reason: `Necesitas ${missing.join(" y ")}` } : { ok: true };
}
