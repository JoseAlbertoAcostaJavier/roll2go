// Descripciones breves de los valores de la pestaña Información (spec §5): textos propios en español, inspirados en
// el SRD 5.2.1 en español (CC BY 4.0). Puro: lo usan la ficha y las pruebas.
import { ABILITY_NAMES, fmtMod, metersText } from "@/lib/rules/dnd2024/labels";
import type { Ability } from "@/lib/rules/types";

/** Por id de habilidad (las 18 claves de `SKILL_ABILITIES`). */
export const SKILL_TEXTS: Record<string, string> = {
  acrobatics:
    "Mantener el equilibrio en situaciones difíciles, como cruzar una cornisa helada o una cubierta que se balancea, y hacer piruetas, saltos mortales o volteretas.",
  "animal handling":
    "Calmar o adiestrar a un animal, evitar que una montura se asuste o intuir las intenciones de una bestia.",
  arcana:
    "Recordar conocimientos sobre conjuros, objetos mágicos, símbolos arcanos, tradiciones mágicas y los planos de existencia.",
  athletics:
    "Trepar, saltar o nadar en condiciones difíciles, y también agarrar, empujar o librarse de otra criatura.",
  deception:
    "Ocultar la verdad de forma convincente con palabras o gestos: mentir, engañar con un disfraz o distraer a alguien.",
  history:
    "Recordar hechos sobre sucesos históricos, personajes legendarios, reinos antiguos, guerras y civilizaciones perdidas.",
  insight:
    "Adivinar las verdaderas intenciones de una criatura, como notar una mentira o anticipar su próximo movimiento, a partir de su lenguaje corporal y su forma de hablar.",
  intimidation:
    "Influir en alguien mediante amenazas, actos hostiles o violencia física para que haga lo que quieres.",
  investigation:
    "Buscar pistas y sacar conclusiones de ellas: encontrar un compartimento oculto, deducir cómo se rompió algo o hallar el punto débil de una estructura.",
  medicine:
    "Estabilizar a un compañero moribundo, diagnosticar una enfermedad o averiguar la causa de una muerte.",
  nature:
    "Recordar conocimientos sobre el terreno, las plantas y los animales, el clima y los ciclos de la naturaleza.",
  perception:
    "Ver, oír o notar de cualquier otro modo lo que te rodea: una conversación tras una puerta, un enemigo oculto o una trampa en el suelo.",
  performance:
    "Entretener a un público con música, baile, teatro, narración u otro tipo de espectáculo.",
  persuasion:
    "Convencer a alguien con tacto, cortesía o buena fe: negociar, pedir un favor o calmar los ánimos.",
  religion:
    "Recordar conocimientos sobre deidades, ritos y oraciones, jerarquías religiosas, símbolos sagrados y cultos secretos.",
  "sleight of hand":
    "Hacer algo con las manos sin que se note: plantar un objeto en otra persona, ocultarlo en tu ropa o robar una bolsa.",
  stealth:
    "Esconderte de tus enemigos, pasar sin que te vean los guardias o moverte sin hacer ruido.",
  survival:
    "Seguir un rastro, cazar, orientarte en la naturaleza, prever el tiempo o evitar arenas movedizas y otros peligros naturales.",
};

export const ABILITY_TEXTS: Record<Ability, string> = {
  str:
    "Mide la potencia física: la fuerza bruta, el entrenamiento atlético y la capacidad de ejercer la fuerza. Se usa en las pruebas de Atletismo, en los ataques con armas cuerpo a cuerpo y para cargar peso.",
  dex:
    "Mide la agilidad, los reflejos y el equilibrio. Se usa en Acrobacias, Juego de manos y Sigilo, en los ataques a distancia, en la iniciativa y en la Clase de armadura.",
  con:
    "Mide la salud, el aguante y la fuerza vital. Su modificador se suma a los puntos de golpe de cada nivel y ayuda a mantener la concentración en los conjuros.",
  int:
    "Mide la agudeza mental, la memoria y la capacidad de razonar. Se usa en Conocimiento arcano, Historia, Investigación, Naturaleza y Religión.",
  wis:
    "Mide la atención al entorno, la intuición y la percepción. Se usa en Medicina, Percepción, Perspicacia, Supervivencia y Trato con animales.",
  cha:
    "Mide la confianza, la elocuencia y la capacidad de influir en los demás. Se usa en Engaño, Interpretación, Intimidación y Persuasión.",
};

/** Texto común de las tiradas de salvación con el nombre de la característica. */
export const saveText = (ability: Ability) =>
  `Una tirada de salvación de ${ABILITY_NAMES[ability]} es un intento de resistir un conjuro, una trampa, un veneno, una enfermedad u otra amenaza. Se tira 1d20, se suma el modificador de ${ABILITY_NAMES[ability]} y, si tienes competencia en esta salvación, tu bonificador por competencia.`;

export const AC_TEXT =
  "La Clase de armadura (CA) indica lo difícil que es acertarte. Un ataque impacta si su tirada iguala o supera tu CA. Depende de la armadura y el escudo que lleves, de tu Destreza y de algunos rasgos de clase.";

export const INITIATIVE_TEXT =
  "La iniciativa decide el orden de los turnos en un combate. Al empezar, cada participante hace una prueba de Destreza y se actúa de mayor a menor resultado.";

export const SPEED_TEXT =
  "La velocidad es la distancia que puedes recorrer en tu turno. Puedes repartir el movimiento antes y después de tu acción; el terreno difícil cuesta el doble.";

/**
 * Unidad de un desglose en el diálogo de detalle: sin unidad, modificadores con signo; `plain`, puntuación de
 * característica o CA (la base y el total sin signo); `feet`, velocidad en pies (la base sin signo y el total con
 * metros).
 */
export type BreakdownUnit = "plain" | "feet";

const feetText = (f: number) => `${f} pies`;

/** Valor de la fila `index` de un desglose: la primera de `plain` y `feet` es la base y no lleva signo. */
export function partText(value: number, index: number, unit?: BreakdownUnit): string {
  if (unit === "feet") return index === 0 ? feetText(value) : `${fmtMod(value)} pies`;
  if (unit === "plain" && index === 0) return String(value);
  return fmtMod(value);
}

export function totalText(total: number, unit?: BreakdownUnit): string {
  if (unit === "feet") return `${feetText(total)} (${metersText(total)})`;
  return unit === "plain" ? String(total) : fmtMod(total);
}
