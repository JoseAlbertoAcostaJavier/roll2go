// Cómo se activa un rasgo de clase o subclase (acción, acción adicional o reacción), deducido de su texto.
// Pura: sin acceso a la base de datos ni a Next.
import type { Activation } from "../types";

/** Texto plano de unas entradas de 5etools: las etiquetas `{@tag texto|…}` se reducen a `texto`. */
function plainText(entries: unknown): string {
  const parts: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === "string") parts.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      walk(o.entries);
      walk(o.items);
      walk(o.entry);
    }
  };
  walk(entries);
  // `{@variantrule Bonus Action|XPHB}` → `Bonus Action`; las etiquetas pueden anidarse
  let text = parts.join(" ");
  for (let prev = ""; prev !== text; ) {
    prev = text;
    text = text.replace(/\{@\w+ ([^{}|]*)[^{}]*\}/g, "$1");
  }
  return text.replace(/\s+/g, " ");
}

// Solo frases en las que el propio rasgo se usa: «As a Bonus Action, you can…», «you can take a Bonus Action to…»
const BONUS = /\b(?:as an? bonus action|take an? bonus action|bonus action to)\b/i;
const REACTION = /\b(?:take an?|use your|as an?|can use) reaction\b/i;
const ACTION = /\b(?:magic action|as an action|take an action|take the attack action)\b/i;

/** Activación de un rasgo según su texto; `undefined` si es pasivo. */
export function featureActivation(entries: unknown): Activation | undefined {
  const text = plainText(entries);
  if (BONUS.test(text)) return "bonus";
  if (REACTION.test(text)) return "reaction";
  if (ACTION.test(text)) return "action";
  return undefined;
}

/**
 * Correcciones a mano, por clave del catálogo (`classFeature:<nombre>|<clase>|xphb|<nivel>`). `null` fuerza «pasivo».
 * Cada una lleva el motivo.
 */
export const ACTIVATION_OVERRIDES: Record<string, Activation | null> = {
  // Extra Attack y variantes: modifican la acción Atacar, no son una acción en sí
  "classFeature:extra attack|barbarian|xphb|5": null,
  "subclassFeature:extra attack|bard|xphb|valor|xphb|6": null,
  "classFeature:extra attack|fighter|xphb|5": null,
  "classFeature:two extra attacks|fighter|xphb|11": null,
  "classFeature:three extra attacks|fighter|xphb|20": null,
  "classFeature:extra attack|monk|xphb|5": null,
  "classFeature:extra attack|paladin|xphb|5": null,
  "classFeature:extra attack|ranger|xphb|5": null,
  // Oleada de acción da una acción adicional sin gastar la propia: no encaja en acción, adicional ni reacción
  "classFeature:action surge|fighter|xphb|2": null,
  "classFeature:action surge|fighter|xphb|17": null,
  // Se activa al activar la Furia, no por sí solo
  "subclassFeature:rage of the wilds|barbarian|xphb|wild heart|xphb|3": null,
  // Modifican otro rasgo o la acción Atacar (la acción adicional que citan es la de otro rasgo)
  "subclassFeature:war magic|fighter|xphb|eldritch knight|xphb|7": null,
  "subclassFeature:improved war magic|fighter|xphb|eldritch knight|xphb|18": null,
  "subclassFeature:fleet step|monk|xphb|open hand|xphb|11": null,
  "subclassFeature:exceptional training|ranger|xphb|beast master|xphb|7": null,
  "classFeature:sorcery incarnate|sorcerer|xphb|7": null,
  // Opción de Golpe astuto: «take an action» describe el efecto sobre el objetivo
  "classFeature:daze (cost: 2d6)|rogue|xphb|14": null,
  // Se usan con la acción Magia; la acción adicional que cita el texto es un efecto posterior o una restricción
  "classFeature:abjure foes|paladin|xphb|9": "action",
  "subclassFeature:nature's sanctuary|druid|xphb|land|xphb|14": "action",
};

/** Activación de un rasgo: la corrección manual manda sobre el texto. */
export function activationFor(key: string, entries: unknown): Activation | undefined {
  if (key in ACTIVATION_OVERRIDES) return ACTIVATION_OVERRIDES[key] ?? undefined;
  return featureActivation(entries);
}
