// Textos en español de los conjuros que también usa el navegador (escuela, nivel, tiempo, alcance, componentes,
// duración), sin `es.json`: la parte que lo necesita (etiquetas de estado, nombres de clase) está en `spellText.ts`.
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
