// Textos en español de los conjuros a partir de los campos de 5etools (tiempo, alcance, duración, componentes,
// etiquetas). El importador guarda el resultado en `SpellData`; la interfaz usa la escuela y la etiqueta de nivel.
import { bbcodeToText } from "@/lib/bbcode";
import { ABILITY_NAMES } from "./labels";
import es from "../i18n/es.json";

type Rec = Record<string, unknown>;
const isObj = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown, fallback: number): number => (typeof v === "number" ? v : fallback);
const decimal = (n: number) => (Math.round(n * 10) / 10).toLocaleString("es-ES");

const SCHOOL_NAMES: Record<string, string> = {
  A: "Abjuración", C: "Conjuración", D: "Adivinación", E: "Encantamiento",
  V: "Evocación", I: "Ilusionismo", N: "Nigromancia", T: "Transmutación",
};
/** Letra de escuela de 5etools (`V`) → «Evocación»; las desconocidas, tal cual. */
export const spellSchoolName = (code: string) => SCHOOL_NAMES[code] ?? code;

/** `0` → «Truco»; `3` → «Nivel 3». */
export const spellLevelLabel = (level: number) => (level === 0 ? "Truco" : `Nivel ${level}`);

/** Unidad en singular y plural. */
const UNITS: Record<string, [string, string]> = {
  action: ["acción", "acciones"],
  bonus: ["acción adicional", "acciones adicionales"],
  reaction: ["reacción", "reacciones"],
  round: ["asalto", "asaltos"],
  minute: ["minuto", "minutos"],
  hour: ["hora", "horas"],
  day: ["día", "días"],
  week: ["semana", "semanas"],
  year: ["año", "años"],
};
const count = (n: number, unit: string) => {
  const names = UNITS[unit];
  return names ? `${n} ${names[n === 1 ? 0 : 1]}` : `${n} ${unit}`;
};

/** `[{ number: 1, unit: "bonus" }]` → «1 acción adicional». La condición de las reacciones no se incluye. */
export function spellTime(time: unknown): string {
  return asArr(time).filter(isObj).map((t) => count(num(t.number, 1), str(t.unit))).join(" o ");
}

/** Pies → «18 metros (60 pies)»; millas → «1,5 kilómetros (1 milla)» (5 pies = 1,5 m; 1 milla = 1,5 km). */
function distance(type: string, amount: number, withFeet = true): string {
  if (type === "miles") {
    const km = `${decimal(amount * 1.5)} kilómetros`;
    return withFeet ? `${km} (${amount} ${amount === 1 ? "milla" : "millas"})` : km;
  }
  const m = `${decimal(amount * 0.3)} metros`;
  return withFeet ? `${m} (${amount} ${amount === 1 ? "pie" : "pies"})` : m;
}

const SPECIAL_RANGES: Record<string, string> = {
  self: "Personal", touch: "Toque", sight: "Vista", unlimited: "Ilimitado",
};
const AREA_NAMES: Record<string, string> = {
  cone: "cono", line: "línea", emanation: "emanación", sphere: "esfera", cube: "cubo",
  cylinder: "cilindro", radius: "radio", hemisphere: "semiesfera", square: "cuadrado", circle: "círculo",
};

/** `{ type: "point", distance: { type: "feet", amount: 60 } }` → «18 metros (60 pies)». */
export function spellRange(range: unknown): string {
  if (!isObj(range)) return "";
  if (range.type === "special") return "Especial";
  const d = isObj(range.distance) ? range.distance : {};
  const dType = str(d.type);
  const amount = num(d.amount, 0);
  if (range.type === "point") return SPECIAL_RANGES[dType] ?? distance(dType, amount);
  // Áreas centradas en el lanzador: cono, línea, emanación, esfera, cubo…
  const area = AREA_NAMES[str(range.type)] ?? str(range.type);
  return `Personal (${area} de ${distance(dType, amount, false)})`;
}

/** `{ v: true, s: true, m: "…" }` → «V, S, M (…)». El texto del material se deja en inglés. */
export function spellComponents(components: unknown): string {
  if (!isObj(components)) return "";
  const out: string[] = [];
  if (components.v) out.push("V");
  if (components.s) out.push("S");
  if (components.m) {
    const m = components.m;
    const text = typeof m === "string" ? m : isObj(m) ? str(m.text) : "";
    out.push(text ? `M (${text})` : "M");
  }
  if (components.r) out.push("R");
  return out.join(", ");
}

/** `[{ type: "timed", duration: { type: "minute", amount: 1 }, concentration: true }]` → «Concentración, hasta 1 minuto». */
export function spellDuration(duration: unknown): string {
  return asArr(duration).filter(isObj).map((d) => {
    switch (d.type) {
      case "instant": return "Instantáneo";
      case "timed": {
        const t = isObj(d.duration) ? d.duration : {};
        const text = count(num(t.amount, 1), str(t.type));
        return d.concentration ? `Concentración, hasta ${text}` : text;
      }
      case "permanent": return asArr(d.ends).includes("trigger") ? "Hasta que se disipe o se active" : "Hasta que se disipe";
      default: return "Especial";
    }
  }).join(" o ");
}

// ---------- etiquetas ----------

// Como en el SRD: «daño de fuego», pero «daño necrótico»
const DAMAGE_TAGS: Record<string, string> = {
  acid: "Daño de ácido", bludgeoning: "Daño contundente", cold: "Daño de frío", fire: "Daño de fuego",
  force: "Daño de fuerza", lightning: "Daño de relámpago", necrotic: "Daño necrótico", piercing: "Daño perforante",
  poison: "Daño de veneno", psychic: "Daño psíquico", radiant: "Daño radiante", slashing: "Daño cortante",
  thunder: "Daño de trueno",
};
const AREA_TAGS: Record<string, string> = {
  C: "cubo", N: "cono", Y: "cilindro", S: "esfera", R: "círculo", Q: "cuadrado", L: "línea", H: "semiesfera",
  W: "muro", E: "emanación",
};
const MISC_TAGS: Record<string, string> = {
  HL: "Curación", THP: "Puntos de golpe temporales", SGT: "Requiere ver al objetivo", PRM: "Efecto permanente",
  SCL: "Mejora con el nivel", SCT: "Más objetivos con el nivel", SMN: "Invoca criaturas", MAC: "Modifica la CA",
  TP: "Teletransporte", FMV: "Movimiento forzado", RO: "Efectos aleatorios", LGTS: "Crea luz solar", LGT: "Crea luz",
  PS: "Viaje planar", OBS: "Oscurece la visión",
  DFT: "Terreno difícil", AAD: "Daño adicional al atacar", OBJ: "Afecta a objetos", ADV: "Da ventaja",
  PIR: "Permanente si se repite", BO: "Quema objetos",
};
const SAVE_ABILITIES: Record<string, keyof typeof ABILITY_NAMES> = {
  strength: "str", dexterity: "dex", constitution: "con", intelligence: "int", wisdom: "wis", charisma: "cha",
};
const conditionName = (c: string) => (es as Record<string, string>)[`condition:${c}`]?.toLowerCase();

/**
 * Etiquetas en español de un conjuro de 5etools (para filtrar): «Daño de fuego», «Salvación de Destreza»,
 * «Ataque de conjuro», «Área: cono», «Estado: hechizado», «Curación»…, «Concentración» y «Ritual». Los códigos
 * desconocidos se omiten.
 */
export function spellTags(raw: unknown): string[] {
  if (!isObj(raw)) return [];
  const codes = (field: string) => asArr(raw[field]).map(str);
  const known = (name: string | undefined) => (name ? [name] : []);
  const tags = [
    ...codes("damageInflict").flatMap((d) => known(DAMAGE_TAGS[d])),
    ...codes("savingThrow").flatMap((s) => known(SAVE_ABILITIES[s] && `Salvación de ${ABILITY_NAMES[SAVE_ABILITIES[s]]}`)),
    ...(codes("spellAttack").length ? ["Ataque de conjuro"] : []),
    ...codes("areaTags").flatMap((a) => known(AREA_TAGS[a] && `Área: ${AREA_TAGS[a]}`)),
    ...codes("conditionInflict").flatMap((c) => known(conditionName(c) && `Estado: ${conditionName(c)}`)),
    ...codes("miscTags").flatMap((m) => known(MISC_TAGS[m])),
    ...(asArr(raw.duration).some((d) => isObj(d) && d.concentration === true) ? ["Concentración"] : []),
    ...(isObj(raw.meta) && raw.meta.ritual === true ? ["Ritual"] : []),
  ];
  return [...new Set(tags)];
}

// ---------- ficha ----------

const SUMMARY_LENGTH = 200;

/** Línea de resumen de un conjuro: el primer párrafo de la descripción (BBCode) en texto plano, recortado. */
export function spellSummary(description: string): string {
  const first = bbcodeToText(description).split(/\n\s*\n/)[0].replace(/\s+/g, " ").trim();
  return first.length <= SUMMARY_LENGTH ? first : `${first.slice(0, SUMMARY_LENGTH - 1).trimEnd()}…`;
}

/**
 * Clases de `SpellData.classes` en español («Mago»); las subclases que lo conceden (`subclass:…`) se omiten y las
 * desconocidas se dejan con mayúscula inicial.
 */
export function spellClassNames(classes: string[]): string[] {
  return classes.filter((c) => !c.startsWith("subclass:")).map((c) =>
    (es as Record<string, string>)[`class:${c}|xphb`] ?? (c ? c[0].toUpperCase() + c.slice(1) : c));
}
