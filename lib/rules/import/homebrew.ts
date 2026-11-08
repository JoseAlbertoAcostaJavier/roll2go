// Suma archivos de homebrew de 5etools a los datos oficiales antes de normalizarlos. Módulo puro.
import { inferWeaponMasteries, type RawFiles } from "./normalize";

type BrewSource = { json: string; full?: string; url?: string; authors?: string[]; convertedBy?: string[] };
export type Homebrew = { _meta?: { sources?: BrewSource[] } } & Partial<Record<
  "class" | "subclass" | "classFeature" | "subclassFeature" | "classFluff" | "optionalfeature" | "race" | "subrace" | "background" | "feat"
  | "spell" | "item" | "baseitem" | "language" | "monster" | "action" | "condition" | "disease",
  unknown[]
>>;

/** Suma un archivo de homebrew a los datos de 5etools. */
export function withHomebrew(raw: RawFiles, brew: Homebrew): RawFiles {
  const more = (base: unknown[] | undefined, extra: unknown[] | undefined) => [...(base ?? []), ...(extra ?? [])];
  return {
    ...raw,
    classes: [...(raw.classes ?? []), { class: brew.class?.map((c) => inferWeaponMasteries(c as Record<string, unknown>, brew.classFeature)), subclass: brew.subclass, classFeature: brew.classFeature, subclassFeature: brew.subclassFeature }],
    classFluff: [...(raw.classFluff ?? []), { classFluff: brew.classFluff }],
    optionalFeatures: { optionalfeature: more(raw.optionalFeatures?.optionalfeature, brew.optionalfeature) },
    races: { race: more(raw.races?.race, brew.race), subrace: more(raw.races?.subrace, brew.subrace) },
    backgrounds: { background: more(raw.backgrounds?.background, brew.background) },
    feats: { feat: more(raw.feats?.feat, brew.feat) },
    items: { item: more(raw.items?.item, brew.item) },
    itemsBase: { baseitem: more(raw.itemsBase?.baseitem, brew.baseitem) },
    languages: { language: more(raw.languages?.language, brew.language) },
    spells: [...(raw.spells ?? []), { spell: brew.spell }],
    bestiary: [...(raw.bestiary ?? []), { monster: brew.monster }],
    actions: { action: more(raw.actions?.action, brew.action) },
    conditions: { condition: more(raw.conditions?.condition, brew.condition), disease: more(raw.conditions?.disease, brew.disease) },
  };
}
