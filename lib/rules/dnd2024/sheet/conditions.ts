// Resúmenes propios (en español) de los estados de las reglas 2024 y efecto del agotamiento. Sin dependencias de
// servidor: lo importan componentes cliente.

/** Clave de 5etools (inglés, minúsculas) → qué supone el estado en la mesa. */
export const CONDITION_RULES: Record<string, string> = {
  blinded: "No ves nada: fallas las pruebas que dependan de la vista. Tus ataques tienen desventaja y los ataques contra ti tienen ventaja.",
  charmed: "No puedes atacar a quien te hechizó ni elegirlo como objetivo de efectos dañinos. Esa criatura tiene ventaja en tus pruebas sociales.",
  deafened: "No oyes nada y fallas automáticamente las pruebas que dependan del oído.",
  frightened: "Tienes desventaja en pruebas y ataques mientras veas la fuente de tu miedo, y no puedes acercarte a ella a propósito.",
  grappled: "Tu velocidad es 0 y no mejora. Tienes desventaja al atacar a cualquiera que no sea quien te agarra. Acaba si te alejan o te sueltas.",
  incapacitated: "No puedes realizar acciones, acciones adicionales ni reacciones, y pierdes la concentración. No puedes hablar y tienes desventaja en la tirada de iniciativa.",
  invisible: "No te ven sin ayuda mágica o de sentidos especiales. Tus ataques tienen ventaja y los ataques contra ti, desventaja.",
  paralyzed: "Estás incapacitado y no te mueves ni hablas. Fallas las salvaciones de Fuerza y Destreza. Los ataques contra ti tienen ventaja y son críticos desde 1,5 m.",
  petrified: "Te conviertes en una sustancia sólida e inanimada: estás incapacitado, tu velocidad es 0 y los ataques contra ti tienen ventaja. Fallas las salvaciones de Fuerza y Destreza, resistes todo el daño y eres inmune al estado envenenado.",
  poisoned: "Tienes desventaja en las tiradas de ataque y en las pruebas de característica.",
  prone: "Solo puedes arrastrarte o levantarte (cuesta la mitad de tu velocidad). Tus ataques tienen desventaja; los ataques contra ti tienen ventaja desde 1,5 m y desventaja desde más lejos.",
  restrained: "Tu velocidad es 0. Los ataques contra ti tienen ventaja y los tuyos, desventaja. Tienes desventaja en las salvaciones de Destreza.",
  stunned: "Estás incapacitado: no actúas ni reaccionas, pero puedes moverte. Fallas las salvaciones de Fuerza y Destreza y los ataques contra ti tienen ventaja.",
  unconscious: "Estás incapacitado, caído e inconsciente sin enterarte de nada; tu velocidad es 0. Fallas las salvaciones de Fuerza y Destreza. Los ataques contra ti tienen ventaja y son críticos desde 1,5 m.",
};

const metersText = (m: number) => m.toLocaleString("es-ES");

/** Efecto de un nivel de agotamiento: −2 por nivel a las pruebas de d20 y −1,5 m de velocidad por nivel; el 6 mata. */
export function exhaustionEffect(level: number): string {
  if (level >= 6) return "Muerte";
  return `Nivel ${level}: −${2 * level} a las pruebas de d20 y −${metersText(1.5 * level)} m de velocidad`;
}
