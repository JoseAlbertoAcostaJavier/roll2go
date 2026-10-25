// Textos en español de los conjuros a partir de los campos de 5etools (etiquetas, resumen, nombres de clase), solo
// para el servidor y el importador: carga `es.json`. Lo que usa el navegador está en `spellTextClient.ts`.
import { bbcodeToText } from "@/lib/utils/bbcode";
import { ABILITY_NAMES } from "../sheet/labels";
import es from "../../i18n/es.json";

export {
  spellComponents, spellDuration, spellLevelLabel, spellRange, spellSchoolName, spellTime,
} from "./spellTextClient";

type Rec = Record<string, unknown>;
const isObj = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

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

// Clases de otros libros que aparecen en las listas de los conjuros pero no están en es.json
const OTHER_CLASS_NAMES: Record<string, string> = { artificer: "Artífice" };

/**
 * Clases de `SpellData.classes` en español («Mago»); las subclases que lo conceden (`subclass:…`) se omiten y las
 * desconocidas se dejan con mayúscula inicial.
 */
export function spellClassNames(classes: string[]): string[] {
  return classes.filter((c) => !c.startsWith("subclass:")).map((c) =>
    (es as Record<string, string>)[`class:${c}|xphb`] ?? OTHER_CLASS_NAMES[c] ?? (c ? c[0].toUpperCase() + c.slice(1) : c));
}
