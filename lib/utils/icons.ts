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

/** Ruta pública del icono (`id` es el identificador, o la letra de escuela de 5etools), o null si no hay. */
export function iconSrc(kind: IconKind, id: string | null | undefined): string | null {
  if (!id) return null;
  switch (kind) {
    case "class": return `/assets/icons/classes/${id}.svg`;
    case "species": return `/assets/icons/species/${id}.png`;
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
