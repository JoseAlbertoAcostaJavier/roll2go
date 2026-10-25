// Generador de nombres (spec de subir de nivel §8.4): «Nombre Apellido/Clan» según la especie y los pronombres, con
// las tablas de nombres de 5etools (Guía de Xanathar para todo). Función pura: el azar se inyecta.
import type { NameTableData } from "@/lib/rules/types";

export type Pronoun = "he" | "she" | "they";
export const PRONOUNS: { id: Pronoun; label: string }[] = [
  { id: "he", label: "Él" },
  { id: "she", label: "Ella" },
  { id: "they", label: "Elle" },
];

// Especies sin tabla propia que usan la de otra; el resto (Goliat, Aasimar…) usan las de Humano
const SPECIES_ALIASES: Record<string, string> = { orc: "half-orc" };
const FALLBACK_SPECIES = "human";

/** «Él/Elle» con los pronombres en el orden de `PRONOUNS`; "" si no hay ninguno. */
export const pronounsText = (list: Pronoun[]) =>
  PRONOUNS.filter((p) => list.includes(p.id)).map((p) => p.label).join("/");

/** Tablas de la especie (por su identificador), o las de Humano si no tiene. */
export function nameTableFor(list: NameTableData[], species: string): NameTableData | null {
  const find = (id: string) => list.find((t) => t.species === id);
  return find(species) ?? find(SPECIES_ALIASES[species] ?? "") ?? find(FALLBACK_SPECIES) ?? null;
}

const pick = <T,>(list: T[], rng: () => number): T => list[Math.floor(rng() * list.length) % list.length];

/**
 * Nombre al azar: Él → tabla masculina; Ella → femenina; Elle, varios o ninguno → cualquiera de las dos. Si la especie
 * tiene tabla de apellidos o clanes, se añade uno. Sin tablas de género, se usan las demás (p. ej. «General»).
 */
export function generateName(tables: NameTableData, pronouns: Pronoun[], rng: () => number = Math.random): string {
  const genders = pronouns.length === 1 && pronouns[0] !== "they" ? [pronouns[0] === "he" ? "male" : "female"] : ["male", "female"];
  const usable = tables.tables.filter((t) => t.names.length > 0);
  let first = usable.filter((t) => genders.includes(t.gender));
  if (first.length === 0) first = usable.filter((t) => t.gender === "male" || t.gender === "female");
  if (first.length === 0) first = usable.filter((t) => t.gender === "other");
  if (first.length === 0) return "";
  const name = pick(pick(first, rng).names, rng);
  const family = usable.filter((t) => t.gender === "family");
  return family.length ? `${name} ${pick(pick(family, rng).names, rng)}` : name;
}

/** Pronombres de un formulario («he,they»), sin repetir y en orden; null si alguno no es válido. */
export function parsePronouns(raw: string): Pronoun[] | null {
  const list = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (!list.every((p) => PRONOUNS.some((x) => x.id === p))) return null;
  return PRONOUNS.map((p) => p.id).filter((id) => list.includes(id));
}
