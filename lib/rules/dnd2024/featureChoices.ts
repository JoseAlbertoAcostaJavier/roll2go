// Elecciones de rasgos que 5etools solo indica en el texto (habilidades, pericia, opciones sin bloque `options`).
// El importador lista los rasgos de clase y subclase cuyo texto pide elegir y no están aquí; para el Manual del
// Jugador 2024 esa lista debe quedar vacía: cada rasgo está en `FEATURE_CHOICES` o en `NOT_A_CHOICE`.
// Solo importa tipos: lo usa también el script de importación.

/**
 * Elección escrita a mano. Sin `from`: cualquier habilidad (o, en la pericia, cualquiera en la que tenga competencia).
 * En `featureOption`, `from` lleva ids estables (`option:…`) con su nombre en `FEATURE_OPTION_LABELS`.
 */
export type ChoiceSpec = { type: "skills" | "expertise" | "featureOption"; count: number; from?: string[] };

const BARBARIAN_SKILLS = ["animal handling", "athletics", "intimidation", "nature", "perception", "survival"];
const FIGHTER_SKILLS = [
  "acrobatics", "animal handling", "athletics", "history", "insight", "intimidation", "persuasion", "perception",
  "survival",
];

// Ids de las opciones escritas a mano: `option:<rasgo>:<opción>`
const optionIds = (feature: string, options: string[]) => options.map((o) => `option:${feature}:${o}`);

/** Clave del rasgo (`classFeature:…|xphb|N` o `subclassFeature:…`) → elecciones que pide. */
export const FEATURE_CHOICES: Record<string, ChoiceSpec[]> = {
  "classFeature:primal knowledge|barbarian|xphb|3": [{ type: "skills", count: 1, from: BARBARIAN_SKILLS }],
  "classFeature:expertise|bard|xphb|2": [{ type: "expertise", count: 2 }],
  "classFeature:expertise|bard|xphb|9": [{ type: "expertise", count: 2 }],
  // Además, dos idiomas (se anotan en el texto libre de idiomas)
  "classFeature:deft explorer|ranger|xphb|2": [{ type: "expertise", count: 1 }],
  "classFeature:expertise|ranger|xphb|9": [{ type: "expertise", count: 2 }],
  "classFeature:expertise|rogue|xphb|1": [{ type: "expertise", count: 2 }],
  "classFeature:expertise|rogue|xphb|6": [{ type: "expertise", count: 2 }],
  "classFeature:scholar|wizard|xphb|2": [{
    type: "expertise", count: 1, from: ["arcana", "history", "investigation", "medicine", "nature", "religion"],
  }],
  "subclassFeature:aspect of the wilds|barbarian|xphb|wild heart|xphb|6": [
    { type: "featureOption", count: 1, from: optionIds("aspect-of-the-wilds", ["owl", "panther", "salmon"]) },
  ],
  "subclassFeature:bonus proficiencies|bard|xphb|lore|xphb|3": [{ type: "skills", count: 3 }],
  // Además, una herramienta de artesano (sin elección en la hoja todavía)
  "subclassFeature:student of war|fighter|xphb|battle master|xphb|3": [{ type: "skills", count: 1, from: FIGHTER_SKILLS }],
  "subclassFeature:otherworldly glamour|ranger|xphb|fey wanderer|xphb|3": [
    { type: "skills", count: 1, from: ["deception", "performance", "persuasion"] },
  ],
  "subclassFeature:hunter's prey|ranger|xphb|hunter|xphb|3": [
    { type: "featureOption", count: 1, from: optionIds("hunters-prey", ["colossus-slayer", "horde-breaker"]) },
  ],
  "subclassFeature:defensive tactics|ranger|xphb|hunter|xphb|7": [
    { type: "featureOption", count: 1, from: optionIds("defensive-tactics", ["escape-the-horde", "multiattack-defense"]) },
  ],
  "subclassFeature:elemental affinity|sorcerer|xphb|draconic|xphb|6": [
    { type: "featureOption", count: 1, from: optionIds("elemental-affinity", ["acid", "cold", "fire", "lightning", "poison"]) },
  ],
};

/** Nombre en español de cada opción escrita a mano (se guarda como `{ ref: { book: "builtin", key: id }, name }`). */
export const FEATURE_OPTION_LABELS: Record<string, string> = {
  "option:aspect-of-the-wilds:owl": "Búho",
  "option:aspect-of-the-wilds:panther": "Pantera",
  "option:aspect-of-the-wilds:salmon": "Salmón",
  "option:hunters-prey:colossus-slayer": "Asesino de colosos",
  "option:hunters-prey:horde-breaker": "Rompehordas",
  "option:defensive-tactics:escape-the-horde": "Escapar de la horda",
  "option:defensive-tactics:multiattack-defense": "Defensa contra ataques múltiples",
  "option:elemental-affinity:acid": "Ácido",
  "option:elemental-affinity:cold": "Frío",
  "option:elemental-affinity:fire": "Fuego",
  "option:elemental-affinity:lightning": "Relámpago",
  "option:elemental-affinity:poison": "Veneno",
};

/** Clases (`nombre|fuente`) cuyo estilo de combate se puede cambiar por otro cada vez que se gana un nivel de la clase. */
export const REPLACEABLE_FIGHTING_STYLE: ReadonlySet<string> = new Set(["fighter|xphb"]);

const CLASSES = [
  "barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard",
];

/**
 * Secretos mágicos: rasgo → listas de las que elige los conjuros nuevos (y los sustitutos) desde ese nivel de clase;
 * cuentan como conjuros de la clase. Los trucos siguen siendo de su lista.
 */
export const MAGICAL_SECRETS: Readonly<Record<string, string[]>> = {
  "classFeature:magical secrets|bard|xphb|10": ["bard", "cleric", "druid", "wizard"],
};

/** Arcano místico: rasgo → nivel del conjuro de la lista de la clase que pide (elección `arcanum`). */
export const MYSTIC_ARCANUM: Readonly<Record<string, number>> = {
  "classFeature:mystic arcanum|warlock|xphb|11": 6,
  "classFeature:mystic arcanum|warlock|xphb|13": 7,
  "classFeature:mystic arcanum|warlock|xphb|15": 8,
  "classFeature:mystic arcanum|warlock|xphb|17": 9,
};

/** Descubrimientos mágicos: rasgo → listas de las que elige sus dos conjuros (elección `bonusSpells`). */
export const MAGICAL_DISCOVERIES: Readonly<Record<string, string[]>> = {
  "subclassFeature:magical discoveries|bard|xphb|lore|xphb|6": ["cleric", "druid", "wizard"],
};

/** Sabio de la escuela: rasgo → escuela (letra de 5etools) de los conjuros gratis del libro (`SpellsPending.free`). */
export const SCHOOL_SAVANT: Readonly<Record<string, string>> = {
  "subclassFeature:abjuration savant|wizard|xphb|abjurer|xphb|3": "A",
  "subclassFeature:divination savant|wizard|xphb|diviner|xphb|3": "D",
  "subclassFeature:evocation savant|wizard|xphb|evoker|xphb|3": "V",
  "subclassFeature:illusion savant|wizard|xphb|illusionist|xphb|3": "I",
};

/** Ilusiones mejoradas: concede Ilusión menor (o, si ya la conoce, un truco de Mago a elegir: `bonusSpells`). */
export const IMPROVED_ILLUSIONS = "subclassFeature:improved illusions|wizard|xphb|illusionist|xphb|3";
/** Truco que concede Ilusiones mejoradas (clave del catálogo, en el libro de la subclase). */
export const IMPROVED_ILLUSIONS_CANTRIP = "spell:minor illusion|xphb";
/** Dominio de conjuros: un conjuro de nivel 1 y otro de nivel 2 del libro, elegidos en la ficha (`spellMastery`). */
export const SPELL_MASTERY = "classFeature:spell mastery|wizard|xphb|18";
/** Conjuros distintivos: dos conjuros de nivel 3 del libro (`bonusSpells`), con un uso cada uno. */
export const SIGNATURE_SPELLS = "classFeature:signature spells|wizard|xphb|20";

/** Origen con el que se muestran los conjuros de cada elección `bonusSpells` (por su `source`). */
export const BONUS_SPELL_ORIGINS: Readonly<Record<string, string>> = {
  ...Object.fromEntries(Object.keys(MAGICAL_DISCOVERIES).map((k) => [k, "Descubrimientos mágicos"])),
  [IMPROVED_ILLUSIONS]: "Ilusiones mejoradas",
  [SIGNATURE_SPELLS]: "Conjuros distintivos",
};

/** Rasgos con conjuros que aplican las reglas de conjuros (`pendingChoices`, `casterBlocks`, `applySpellOp`). */
export const SPELL_RULE_FEATURES: ReadonlySet<string> = new Set([
  ...Object.keys(MAGICAL_SECRETS), ...Object.keys(MYSTIC_ARCANUM), ...Object.keys(MAGICAL_DISCOVERIES),
  ...Object.keys(SCHOOL_SAVANT), IMPROVED_ILLUSIONS, SPELL_MASTERY, SIGNATURE_SPELLS,
]);

/** Rasgos XPHB cuyo texto dice «choose» u «of your choice» pero no piden una elección de rasgo al subir de nivel. */
export const NOT_A_CHOICE: ReadonlySet<string> = new Set([
  // La elección la pide la subclase (regla 1)
  ...CLASSES.map((c) => `classFeature:${c} subclass|${c}|xphb|3`),
  // La piden las progresiones de dotes, rasgos opcionales o maestrías (reglas 3–5)
  ...CLASSES.map((c) => `classFeature:epic boon|${c}|xphb|19`),
  ...["barbarian", "fighter", "paladin", "ranger", "rogue"].map((c) => `classFeature:weapon mastery|${c}|xphb|1`),
  "classFeature:fighting style|fighter|xphb|1",
  "classFeature:fighting style|paladin|xphb|2",
  "classFeature:fighting style|ranger|xphb|2",
  "classFeature:metamagic|sorcerer|xphb|2",
  "classFeature:metamagic|sorcerer|xphb|10",
  "classFeature:metamagic|sorcerer|xphb|17",
  "classFeature:eldritch invocations|warlock|xphb|1",
  "subclassFeature:combat superiority|fighter|xphb|battle master|xphb|3",
  "subclassFeature:additional fighting style|fighter|xphb|champion|xphb|7",
  // Conjuros: los pide la elección `spells` (regla 8 de `pendingChoices`)
  ...["bard", "cleric", "druid", "paladin", "ranger", "sorcerer", "wizard"].map((c) => `classFeature:spellcasting|${c}|xphb|1`),
  "classFeature:pact magic|warlock|xphb|1",
  "subclassFeature:spellcasting|fighter|xphb|eldritch knight|xphb|3",
  "subclassFeature:spellcasting|rogue|xphb|arcane trickster|xphb|3",
  // Idioma: se anota en el texto libre de idiomas
  "classFeature:thieves' cant|rogue|xphb|1",
  // Compañero de bestia: los Compañeros están fuera de alcance
  "subclassFeature:primal companion|ranger|xphb|beast master|xphb|3",
  // Solo ambientación o tablas para tirar (sin efecto en la hoja)
  "subclassFeature:life domain|cleric|xphb|life|xphb|3",
  "subclassFeature:archfey patron|warlock|xphb|archfey|xphb|3",
  "subclassFeature:great old one patron|warlock|xphb|great old one|xphb|3",
  "subclassFeature:fey wanderer spells|ranger|xphb|fey wanderer|xphb|3",
  "subclassFeature:clockwork spells|sorcerer|xphb|clockwork|xphb|3",
  // Se decide durante el juego (al usar el rasgo, al enfurecerse, tras un descanso…), no al subir de nivel
  "classFeature:brutal strike|barbarian|xphb|9",
  "classFeature:channel divinity|cleric|xphb|2",
  "classFeature:turn undead|cleric|xphb|2",
  "classFeature:divine intervention|cleric|xphb|10",
  "classFeature:greater divine intervention|cleric|xphb|20",
  "classFeature:wild shape|druid|xphb|2",
  "classFeature:primal strike|druid|xphb|7",
  "classFeature:archdruid|druid|xphb|20",
  "classFeature:deflect attacks|monk|xphb|3",
  "classFeature:heightened focus|monk|xphb|10",
  "classFeature:channel divinity|paladin|xphb|3",
  "classFeature:arcane recovery|wizard|xphb|1",
  "subclassFeature:intimidating presence|barbarian|xphb|berserker|xphb|14",
  "subclassFeature:rage of the wilds|barbarian|xphb|wild heart|xphb|3",
  "subclassFeature:power of the wilds|barbarian|xphb|wild heart|xphb|14",
  "subclassFeature:vitality of the tree|barbarian|xphb|world tree|xphb|3",
  "subclassFeature:travel along the tree|barbarian|xphb|world tree|xphb|14",
  "subclassFeature:divine fury|barbarian|xphb|zealot|xphb|3",
  "subclassFeature:zealous presence|barbarian|xphb|zealot|xphb|10",
  "subclassFeature:inspiring movement|bard|xphb|dance|xphb|6",
  "subclassFeature:mantle of inspiration|bard|xphb|glamour|xphb|3",
  "subclassFeature:preserve life|cleric|xphb|life|xphb|3",
  "subclassFeature:radiance of the dawn|cleric|xphb|light|xphb|3",
  "subclassFeature:blessing of the trickster|cleric|xphb|trickery|xphb|3",
  "subclassFeature:improved duplicity|cleric|xphb|trickery|xphb|17",
  "subclassFeature:circle of the land spells|druid|xphb|land|xphb|3",
  "subclassFeature:land's aid|druid|xphb|land|xphb|3",
  "subclassFeature:natural recovery|druid|xphb|land|xphb|6",
  "subclassFeature:wrath of the sea|druid|xphb|sea|xphb|3",
  "subclassFeature:starry form|druid|xphb|stars|xphb|3",
  "subclassFeature:telekinetic movement|fighter|xphb|psi warrior|xphb|3",
  "subclassFeature:bulwark of force|fighter|xphb|psi warrior|xphb|15",
  "subclassFeature:elemental burst|monk|xphb|elements|xphb|6",
  "subclassFeature:elemental epitome|monk|xphb|elements|xphb|17",
  "subclassFeature:nature's wrath|paladin|xphb|ancients|xphb|3",
  "subclassFeature:inspiring smite|paladin|xphb|glory|xphb|3",
  "subclassFeature:misty wanderer|ranger|xphb|fey wanderer|xphb|15",
  "subclassFeature:psychic whispers|rogue|xphb|soulknife|xphb|3",
  "subclassFeature:telepathic speech|sorcerer|xphb|aberrant|xphb|3",
  "subclassFeature:revelation in flesh|sorcerer|xphb|aberrant|xphb|14",
  "subclassFeature:clockwork cavalcade|sorcerer|xphb|clockwork|xphb|18",
  "subclassFeature:wild magic surge|sorcerer|xphb|wild magic|xphb|3",
  "subclassFeature:tamed surge|sorcerer|xphb|wild magic|xphb|18",
  "subclassFeature:steps of the fey|warlock|xphb|archfey|xphb|3",
  "subclassFeature:celestial resilience|warlock|xphb|celestial|xphb|10",
  "subclassFeature:searing vengeance|warlock|xphb|celestial|xphb|14",
  "subclassFeature:fiendish resilience|warlock|xphb|fiend|xphb|10",
  "subclassFeature:awakened mind|warlock|xphb|great old one|xphb|3",
  "subclassFeature:eldritch hex|warlock|xphb|great old one|xphb|10",
  "subclassFeature:portent|wizard|xphb|diviner|xphb|3",
  "subclassFeature:the third eye|wizard|xphb|diviner|xphb|10",
  "subclassFeature:sculpt spells|wizard|xphb|evoker|xphb|6",
  "subclassFeature:illusory reality|wizard|xphb|illusionist|xphb|14",
]);

/** Rasgos con la elección en texto ya resuelta: los que el informe del importador no debe listar. */
export const SPECIFIED_CHOICES: ReadonlySet<string> = new Set([
  ...Object.keys(FEATURE_CHOICES), ...NOT_A_CHOICE, ...SPELL_RULE_FEATURES,
]);
