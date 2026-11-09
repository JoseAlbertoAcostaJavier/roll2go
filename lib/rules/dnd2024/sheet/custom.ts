// Lo que el jugador añade o reordena a mano en la ficha (campo `sheet.custom`): ataques, acciones y rasgos propios,
// categorías de notas, defensas manuales y el orden u ocultación de las filas de cada sección. Funciones puras: validan la
// petición del cliente sobre la hoja guardada y devuelven la hoja nueva. Las hojas guardadas antes no tienen el campo.
import type { DefenseKind } from "../derive/defenses";
import { CONDITION_NAMES, DAMAGE_TYPE_NAMES } from "./labels";
import type { CustomItem, Dnd2024SheetV2, NoteCategory, SheetCustom } from "./sheet";

export type { CustomItem, NoteCategory, SheetCustom };

/** Fuente con que salen las defensas añadidas a mano en su desglose. */
export const MANUAL_DEFENSE_SOURCE = "Añadida a mano";

export const CUSTOM_LIMITS = {
  items: 200, notes: 30, keys: 400, keyLength: 300,
  name: 80, short: 60, text: 4000, noteText: 10000,
} as const;

export const ACTION_GROUP_IDS = ["action", "bonus", "reaction", "other"] as const;
export const FEATURE_SECTION_IDS = ["clase", "especie", "dotes", "otros"] as const;
const DEFENSE_KINDS: DefenseKind[] = ["resist", "immune", "vulnerable", "conditionImmune"];

export const defenseTypes = (kind: DefenseKind): string[] =>
  kind === "conditionImmune"
    ? Object.keys(CONDITION_NAMES).filter((k) => k !== "exhaustion" && k !== "disease")
    : Object.keys(DAMAGE_TYPE_NAMES);

export type CustomOp =
  | { op: "addItem"; item: Omit<CustomItem, "id"> }
  | { op: "removeItem"; id: string }
  | { op: "addNote"; title: string }
  | { op: "updateNote"; id: string; title?: string; text?: string }
  | { op: "removeNote"; id: string }
  | { op: "defense"; kind: DefenseKind; type: string; active: boolean }
  | { op: "addCondition"; name: string; description?: string }
  | { op: "conditionActive"; id: string; active: boolean }
  | { op: "removeCondition"; id: string }
  | { op: "order"; section: string; keys: string[] }
  | { op: "hide"; key: string; hidden: boolean }
  | { op: "basicActive"; key: string; active: boolean; core: boolean }
  | { op: "basicEdit"; key: string; name: string; details: string }
  | { op: "basicEditClear"; key: string };

/** Operaciones sobre las acciones básicas: el servidor comprueba antes la campaña y el catálogo. */
export const BASIC_OPS: readonly string[] = ["basicActive", "basicEdit", "basicEditClear"];

export type CustomResult = { ok: true; sheet: Dnd2024SheetV2; custom: SheetCustom } | { ok: false; error: string };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Lo personalizado de la hoja, con valores por defecto para las guardadas antes. */
export function customOf(sheet: Pick<Dnd2024SheetV2, "custom">): SheetCustom {
  const c = sheet.custom;
  return {
    items: c?.items ?? [], notes: c?.notes ?? [], defenses: c?.defenses ?? [], conditions: c?.conditions ?? [],
    order: c?.order ?? {}, hidden: c?.hidden ?? [], basics: c?.basics ?? { on: [], off: [], edits: [] },
  };
}

/** Texto recortado, sin pasar de `max`; null si no es texto o se pasa. */
function text(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > max ? null : t;
}

// Valida un elemento nuevo según su tipo y lo devuelve con su id
function parseItem(raw: unknown, id: string): CustomItem | string {
  if (!isObj(raw)) return "Petición no válida.";
  const name = text(raw.name, CUSTOM_LIMITS.name);
  if (!name) return "Ponle un nombre (máximo 80 caracteres).";
  if (raw.kind === "attack") {
    const [range, hit, damage] = [text(raw.range ?? "", CUSTOM_LIMITS.short), text(raw.hit ?? "", CUSTOM_LIMITS.short), text(raw.damage ?? "", CUSTOM_LIMITS.short)];
    const notes = text(raw.notes ?? "", CUSTOM_LIMITS.text);
    if (range === null || hit === null || damage === null || notes === null) return "Algún campo es demasiado largo.";
    return { id, kind: "attack", name, range, hit, damage, notes };
  }
  if (raw.kind === "action") {
    if (!ACTION_GROUP_IDS.includes(raw.group as (typeof ACTION_GROUP_IDS)[number])) return "Petición no válida.";
    const details = text(raw.details ?? "", CUSTOM_LIMITS.text);
    if (details === null) return "El detalle es demasiado largo.";
    return { id, kind: "action", group: raw.group as (typeof ACTION_GROUP_IDS)[number], name, details };
  }
  if (raw.kind === "feature") {
    if (!FEATURE_SECTION_IDS.includes(raw.section as (typeof FEATURE_SECTION_IDS)[number])) return "Petición no válida.";
    const [source, description] = [text(raw.source ?? "", CUSTOM_LIMITS.short), text(raw.description ?? "", CUSTOM_LIMITS.text)];
    if (source === null || description === null) return "Algún campo es demasiado largo.";
    return { id, kind: "feature", section: raw.section as (typeof FEATURE_SECTION_IDS)[number], name, source, description };
  }
  return "Petición no válida.";
}

/** Aplica una operación; `newId` da el id de lo que se crea. */
export function applyCustom(sheet: Dnd2024SheetV2, op: unknown, newId: () => string): CustomResult {
  if (!isObj(op)) return fail("Petición no válida.");
  const c = customOf(sheet);
  const done = (custom: SheetCustom): CustomResult => ({ ok: true, custom, sheet: { ...sheet, custom } });

  switch (op.op) {
    case "addItem": {
      if (c.items.length >= CUSTOM_LIMITS.items) return fail("Has llegado al máximo de elementos personalizados.");
      const item = parseItem(op.item, newId());
      if (typeof item === "string") return fail(item);
      return done({ ...c, items: [...c.items, item] });
    }
    case "removeItem": {
      if (typeof op.id !== "string") return fail("Petición no válida.");
      return done({ ...c, items: c.items.filter((i) => i.id !== op.id) });
    }
    case "addNote": {
      const title = text(op.title, CUSTOM_LIMITS.name);
      if (!title) return fail("Ponle un título a la categoría (máximo 80 caracteres).");
      if (c.notes.length >= CUSTOM_LIMITS.notes) return fail("Has llegado al máximo de categorías.");
      return done({ ...c, notes: [...c.notes, { id: newId(), title, text: "" }] });
    }
    case "updateNote": {
      const note = c.notes.find((n) => n.id === op.id);
      if (!note) return fail("Esa categoría ya no existe.");
      const next = { ...note };
      if (op.title !== undefined) {
        const title = text(op.title, CUSTOM_LIMITS.name);
        if (!title) return fail("Ponle un título a la categoría (máximo 80 caracteres).");
        next.title = title;
      }
      if (op.text !== undefined) {
        // (el texto conserva sus espacios: solo se comprueba su longitud)
        if (typeof op.text !== "string" || op.text.length > CUSTOM_LIMITS.noteText) return fail("El texto es demasiado largo.");
        next.text = op.text;
      }
      return done({ ...c, notes: c.notes.map((n) => (n.id === note.id ? next : n)) });
    }
    case "removeNote": {
      if (typeof op.id !== "string") return fail("Petición no válida.");
      return done({ ...c, notes: c.notes.filter((n) => n.id !== op.id) });
    }
    case "defense": {
      const kind = op.kind as DefenseKind;
      if (!DEFENSE_KINDS.includes(kind) || typeof op.type !== "string" || typeof op.active !== "boolean") return fail("Petición no válida.");
      if (!defenseTypes(kind).includes(op.type)) return fail("Ese tipo no existe.");
      const others = c.defenses.filter((d) => !(d.kind === kind && d.type === op.type));
      return done({ ...c, defenses: op.active ? [...others, { kind, type: op.type }] : others });
    }
    case "addCondition": {
      const name = text(op.name, CUSTOM_LIMITS.name);
      if (!name) return fail("Ponle un nombre al estado (máximo 80 caracteres).");
      const description = text(op.description ?? "", CUSTOM_LIMITS.text);
      if (description === null) return fail("La descripción es demasiado larga.");
      if (c.conditions.length >= CUSTOM_LIMITS.notes) return fail("Has llegado al máximo de estados propios.");
      return done({ ...c, conditions: [...c.conditions, { id: newId(), name, description, active: true }] });
    }
    case "conditionActive": {
      if (typeof op.active !== "boolean" || !c.conditions.some((x) => x.id === op.id)) return fail("Ese estado ya no existe.");
      return done({ ...c, conditions: c.conditions.map((x) => (x.id === op.id ? { ...x, active: op.active as boolean } : x)) });
    }
    case "removeCondition": {
      if (typeof op.id !== "string") return fail("Petición no válida.");
      return done({ ...c, conditions: c.conditions.filter((x) => x.id !== op.id) });
    }
    case "order": {
      if (typeof op.section !== "string" || op.section.length > CUSTOM_LIMITS.keyLength) return fail("Petición no válida.");
      const keys = op.keys;
      if (!Array.isArray(keys) || keys.length > CUSTOM_LIMITS.keys || !keys.every((k) => typeof k === "string" && k.length <= CUSTOM_LIMITS.keyLength))
        return fail("Petición no válida.");
      return done({ ...c, order: { ...c.order, [op.section]: keys as string[] } });
    }
    case "hide": {
      if (typeof op.key !== "string" || op.key.length > CUSTOM_LIMITS.keyLength || typeof op.hidden !== "boolean") return fail("Petición no válida.");
      const others = c.hidden.filter((k) => k !== op.key);
      if (op.hidden && others.length >= CUSTOM_LIMITS.keys) return fail("Has ocultado demasiados elementos.");
      return done({ ...c, hidden: op.hidden ? [...others, op.key] : others });
    }
    case "basicActive": {
      if (typeof op.key !== "string" || op.key.length > CUSTOM_LIMITS.keyLength || typeof op.active !== "boolean" || typeof op.core !== "boolean")
        return fail("Petición no válida.");
      const list = op.core ? "off" : "on";
      const others = c.basics[list].filter((k) => k !== op.key);
      // Las básicas se guardan cuando se apagan y las demás cuando se encienden
      const stored = op.core ? !op.active : op.active;
      if (stored && others.length >= CUSTOM_LIMITS.keys) return fail("Has cambiado demasiadas acciones.");
      return done({ ...c, basics: { ...c.basics, [list]: stored ? [...others, op.key] : others } });
    }
    case "basicEdit": {
      if (typeof op.key !== "string" || op.key.length > CUSTOM_LIMITS.keyLength) return fail("Petición no válida.");
      const name = text(op.name, CUSTOM_LIMITS.name);
      if (!name) return fail("Ponle un nombre (máximo 80 caracteres).");
      const details = text(op.details ?? "", CUSTOM_LIMITS.text);
      if (details === null) return fail("La descripción es demasiado larga.");
      const others = c.basics.edits.filter((e) => e.key !== op.key);
      if (others.length >= CUSTOM_LIMITS.keys) return fail("Has editado demasiadas acciones.");
      return done({ ...c, basics: { ...c.basics, edits: [...others, { key: op.key, name, details }] } });
    }
    case "basicEditClear": {
      if (typeof op.key !== "string") return fail("Petición no válida.");
      return done({ ...c, basics: { ...c.basics, edits: c.basics.edits.filter((e) => e.key !== op.key) } });
    }
    default:
      return fail("Petición no válida.");
  }
}

/** Filas en el orden guardado para la sección: primero las que lo tienen; las nuevas, al final en su orden natural. */
export function ordered<T extends { key: string }>(rows: T[], order: string[] | undefined): T[] {
  if (!order?.length) return rows;
  const position = new Map(order.map((k, i) => [k, i]));
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => (position.get(a.row.key) ?? order.length + a.i) - (position.get(b.row.key) ?? order.length + b.i))
    .map((x) => x.row);
}
