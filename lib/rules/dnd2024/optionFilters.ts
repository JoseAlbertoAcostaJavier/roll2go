// Filtros del creador para elegir especie y clase. Cada opción se resume en «facetas» (grupo → valores); dentro de un grupo
// basta con un valor marcado y entre grupos tienen que cumplirse todos. Módulo puro.
import type { EntryOption } from "@/lib/rules/catalog/types";
import { normalizeName } from "@/lib/rules/schemas";
import type { ClassData, LineageData, SpeciesData } from "@/lib/rules/types";
import { ABILITY_NAMES, sizeName } from "./sheet/labels";

export type Facets = Record<string, string[]>;
export type FilterState = Record<string, string[]>;
export type FilterGroup = { id: string; label: string; options: { id: string; label: string }[] };

type GroupDef = { id: string; label: string; name?: (value: string) => string; order?: string[] };

const YES_NO = ["yes", "no"];
const yesNo = (value: string) => (value === "yes" ? "Sí" : "No");
const yes = (v: boolean) => [v ? "yes" : "no"];

const CREATURE_TYPES: Record<string, string> = {
  aberration: "Aberración", beast: "Bestia", celestial: "Celestial", construct: "Constructo", dragon: "Dragón",
  elemental: "Elemental", fey: "Feérico", fiend: "Infernal", giant: "Gigante", humanoid: "Humanoide",
  monstrosity: "Monstruosidad", ooze: "Cieno", plant: "Planta", undead: "No muerto",
};
const ARMOR: Record<string, string> = { light: "Ligera", medium: "Media", heavy: "Pesada", shield: "Escudo", none: "Sin armadura" };
const WEAPONS: Record<string, string> = { simple: "Sencillas", martial: "Marciales", someMartial: "Algunas marciales" };
const named = (names: Record<string, string>) => (value: string) => names[value] ?? value;

const SPECIES_GROUPS: GroupDef[] = [
  { id: "book", label: "Libro de origen" },
  { id: "size", label: "Tamaño", name: sizeName, order: ["S", "M", "L"] },
  { id: "creatureType", label: "Tipo de criatura", name: named(CREATURE_TYPES) },
  { id: "magic", label: "Magia innata", name: yesNo, order: YES_NO },
  { id: "armor", label: "Armadura innata", name: yesNo, order: YES_NO },
  { id: "resist", label: "Resistencias", name: yesNo, order: YES_NO },
];
const CLASS_GROUPS: GroupDef[] = [
  { id: "book", label: "Libro de origen" },
  { id: "hitDie", label: "Dado de golpe", name: (v) => `d${v}`, order: ["6", "8", "10", "12"] },
  { id: "armor", label: "Competencia con armaduras", name: named(ARMOR), order: Object.keys(ARMOR) },
  { id: "weapons", label: "Competencia con armas", name: named(WEAPONS), order: Object.keys(WEAPONS) },
  { id: "primary", label: "Característica principal", name: (v) => ABILITY_NAMES[v as keyof typeof ABILITY_NAMES] ?? v, order: Object.keys(ABILITY_NAMES) },
];

/** Facetas de una especie; los legados cuentan para la magia y las resistencias (Elfo, Dracónido…). */
export function speciesFacets(option: EntryOption, lineages: EntryOption[] = []): Facets {
  const data = option.data as SpeciesData;
  const lines = lineages.map((l) => l.data as LineageData);
  return {
    book: [option.bookName],
    size: data.size,
    creatureType: [data.creatureType],
    magic: yes(data.spells.length > 0 || lines.some((l) => l.spells.length > 0)),
    armor: yes(!!data.naturalArmor),
    resist: yes(!!data.defenses?.resist?.length || lines.some((l) => !!l.defenses?.resist?.length)),
  };
}

/** Facetas de una clase. El artífice de Tasha no declara característica principal: se usa la de sus conjuros. */
export function classFacets(option: EntryOption): Facets {
  const data = option.data as ClassData;
  const primary = data.primaryAbility.length ? data.primaryAbility : data.spellcasting ? [data.spellcasting.ability] : [];
  const weapons = data.weapons.flatMap((w) => (WEAPONS[w] ? [w] : /^martial/i.test(w) ? ["someMartial"] : []));
  return {
    book: [option.bookName],
    hitDie: [String(data.hitDie)],
    armor: data.armor.length ? data.armor.filter((a) => ARMOR[a]) : ["none"],
    weapons,
    primary,
  };
}

/** Grupos con los valores que existen de verdad en las opciones; un grupo sin nada que distinguir no se ofrece. */
export function filterGroups(kind: "species" | "class", facets: Facets[]): FilterGroup[] {
  return (kind === "species" ? SPECIES_GROUPS : CLASS_GROUPS).flatMap((group) => {
    const values = [...new Set(facets.flatMap((f) => f[group.id] ?? []))];
    if (values.length < 2) return [];
    const name = group.name ?? ((v: string) => v);
    const rank = (v: string) => (group.order ? group.order.indexOf(v) : -1);
    values.sort((a, b) => rank(a) - rank(b) || name(a).localeCompare(name(b), "es"));
    return [{ id: group.id, label: group.label, options: values.map((id) => ({ id, label: name(id) })) }];
  });
}

export const matchesFilters = (facets: Facets, state: FilterState) =>
  Object.entries(state).every(([group, wanted]) => !wanted.length || wanted.some((v) => facets[group]?.includes(v)));

export function matchesSearch(option: EntryOption, query: string) {
  const q = normalizeName(query.trim());
  return !q || normalizeName(option.nameEs ?? option.name).includes(q) || normalizeName(option.name).includes(q);
}

/** Si la entrada es de un libro con las reglas de 2024 (va en su clave: «class:artificer|efa»). */
export const isEdition2024 = (key: string) => /\|(xphb|xdmg|xmm|efa|frhof|fraif|bloodhunter2024)$/.test(key);

/** Marca o desmarca un valor; los grupos vacíos desaparecen. */
export function toggleFilter(state: FilterState, group: string, value: string): FilterState {
  const current = state[group] ?? [];
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  const rest = { ...state };
  delete rest[group];
  return next.length ? { ...rest, [group]: next } : rest;
}
