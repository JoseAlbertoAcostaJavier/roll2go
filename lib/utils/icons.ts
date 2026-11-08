import type { SpellAreaShape } from "@/lib/rules/dnd2024/spells/spellArea";
// Iconos de clase, escuela de magia, especie, estado y grupos de rasgos (public/assets/icons)

export type IconKind =
  | "class" | "school" | "species" | "status" | "feature"
  | "damageType" | "weaponType" | "darkSchool" | "action" | "condition" | "environment";

/** Iconos de grupos de rasgos (public/assets/icons/features). */
export type FeatureIcon = "feats" | "invocations" | "others" | "weapon-mastery";

// Escuela de 5etools (`SpellData.school`) → nombre del archivo
const SCHOOLS: Record<string, string> = {
  A: "abjuration", C: "conjuration", D: "divination", E: "enchantment",
  V: "evocation", I: "illusion", N: "necromancy", T: "transmutation",
};

// Clases y especies con icono (public/assets/icons): las demás muestran su inicial sin pedir una imagen que no existe
const CLASSES = ["artificer", "barbarian", "bard", "blood-hunter", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard"];
// Retratos de las tarjetas del creador (public/assets/class-portraits y species-portraits)
const CLASS_PORTRAITS = ["artificer", "barbarian", "bard", "blood-hunter", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard"];
const SPECIES_PORTRAITS = [
  "aarakocra", "aasimar", "bugbear", "centaur", "changeling", "deep-gnome", "dhampir", "dragonborn", "duergar", "dwarf", "eladrin", "elf",
  "fairy", "firbolg", "genasi", "githyanki", "githzerai", "gnome", "goblin", "goliath", "halfling", "harengon", "hexblood", "hobgoblin",
  "human", "kalashtar", "kender", "kenku", "khoravar", "kobold", "lizardfolk", "minotaur", "orc", "reborn", "satyr", "sea-elf", "shadar-kai",
  "shifter", "tabaxi", "tiefling", "tortle", "triton", "warforged", "yuan-ti",
];
// Según el sitio, el id llega como «blood hunter» o «blood-hunter»
const slug = (id: string) => id.trim().toLowerCase().replace(/\s+/g, "-");
const SPECIES = ["dragonborn", "dwarf", "elf", "gnome", "goliath", "halfling", "human", "orc", "tiefling"];

// Iconos oscuros (public/assets/icons/dark): SVG blancos que se pintan como máscara (MaskIcon).
// Listas cerradas para que un id desconocido dé null en vez de una ruta rota.
const DAMAGE_TYPES = ["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder"];
const WEAPON_TYPES = ["melee", "ranged"];
const ACTIONS = [
  "attack", "cast-spell", "climb", "communicate", "concentration", "dash", "disengage", "dodge", "drop-prone", "escape", "grapple", "help",
  "hide", "improvise", "move", "offhand-attack", "opportunity-attack", "quick-interaction", "ready-action", "search", "shove", "stand-up", "use-shield",
];
const CONDITIONS = [
  "blinded", "charmed", "deafened", "exhaustion", "falling", "flying", "frightened", "grappled", "incapacitated",
  "invisible", "paralyzed", "petrified", "poisoned", "prone", "restrained", "stunned", "unconscious",
];
const ENVIRONMENT = ["bright-light", "darkness"];

/**
 * Silueta de la clase sin fondo (public/assets/icons/classes/no-background), o null si no hay. Es casi negra: se pinta como
 * máscara (MaskIcon) con el color del texto para que se vea sobre fondos oscuros.
 */
export function classGlyphSrc(id: string | null | undefined): string | null {
  if (!id) return null;
  const known = slug(id);
  if (known === "apothecary") return "/assets/icons/classes/no-background/SCGtD/apothecary.svg";
  if (!CLASSES.includes(known)) return "/assets/icons/classes/no-background/sin-imagen.svg";
  const name = known.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
  return encodeURI(`/assets/icons/classes/no-background/Class Icon - ${name}.svg`);
}

/** Retrato de la tarjeta de clase o especie; sin imagen propia, el genérico. */
const AREA_ICONS: Partial<Record<SpellAreaShape, string>> = { sphere: "sphere", emanation: "sphere", radius: "sphere", cube: "cube", cone: "cone", cylinder: "cylinder" };

/** Icono del área de un conjuro; null en las líneas, que no tienen. */
export function spellAreaSrc(shape: SpellAreaShape): string | null {
  const icon = AREA_ICONS[shape];
  return icon ? `/assets/icons/spell-ranges/${icon}.svg` : null;
}

export function portraitSrc(kind: "class" | "species", id: string): string {
  const known = slug(id);
  const [dir, list] = kind === "class" ? ["class-portraits", CLASS_PORTRAITS] : ["species-portraits", SPECIES_PORTRAITS];
  return `/assets/${dir}/${list.includes(known) ? known : "sin-imagen"}.webp`;
}

/** Ruta pública del icono (`id` es el identificador, o la letra de escuela de 5etools), o null si no hay. */
export function iconSrc(kind: IconKind, id: string | null | undefined): string | null {
  if (!id) return null;
  switch (kind) {
    case "class": return CLASSES.includes(slug(id)) ? `/assets/icons/classes/${slug(id)}.svg` : "/assets/icons/classes/no-imagen.svg";
    case "species": return SPECIES.includes(id) ? `/assets/icons/species/${id}.png` : null;
    case "school": return SCHOOLS[id] ? `/assets/icons/schools/${SCHOOLS[id]}.svg` : null;
    case "status": return `/assets/icons/status/${id}.svg`;
    case "feature": return `/assets/icons/features/${id}.svg`;
    case "damageType": return DAMAGE_TYPES.includes(id) ? `/assets/icons/dark/damage-types/${id}.svg` : null;
    case "weaponType": return WEAPON_TYPES.includes(id) ? `/assets/icons/dark/weapon-types/${id}.svg` : null;
    case "darkSchool": return SCHOOLS[id] ? `/assets/icons/dark/schools/${SCHOOLS[id]}.svg` : null;
    case "action": return ACTIONS.includes(id) ? `/assets/icons/dark/actions/${id}.svg` : null;
    case "condition": return CONDITIONS.includes(id) ? `/assets/icons/dark/conditions/${id}.svg` : null;
    case "environment": return ENVIRONMENT.includes(id) ? `/assets/icons/dark/environment/${id}.svg` : null;
  }
}
