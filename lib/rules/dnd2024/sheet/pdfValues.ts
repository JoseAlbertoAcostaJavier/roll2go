// Valores de la plantilla PDF de la ficha (DnD_2024_Character-Sheet): del personaje a los campos del formulario. Los campos
// tienen nombres genéricos («Text63»), así que aquí está el mapa. Módulo puro; quien abre y escribe el PDF es
// `lib/server/characters/sheetPdf.ts`.
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import type { Derived } from "@/lib/rules/dnd2024/derive";
import type { ActionItem } from "@/lib/rules/dnd2024/derive/actions";
import type { Ability, ItemData, Ref, SpellData } from "@/lib/rules/types";
import { ALIGNMENTS } from "./alignments";
import { customOf } from "./custom";
import { refKey } from "./equipmentRefs";
import type { ItemAction } from "./itemActions";
import { ABILITY_NAMES, CONDITION_NAMES, defenseTypeName, proficiencyName, sizeName, speciesLabel, toolName } from "./labels";
import type { HitDicePool } from "./rest";
import type { Dnd2024SheetV2 } from "./sheet";

export type PdfValues = {
  text: Record<string, string>;
  checked: string[];
  /** Tamaño de letra de los campos cuyo texto no cabe con el de la plantilla. */
  sizes: Record<string, number>;
};

export type PdfInput = {
  name: string;
  backstory: string;
  sheet: Dnd2024SheetV2;
  derived: Derived;
  /** Catálogo del personaje, con sus conjuros. */
  entries: Map<string, CatalogEntry>;
  pools: HitDicePool[];
  actions: ActionItem[];
  itemActions: ItemAction[];
};

const T = (n: number | string) => `Text${n}`;
const C = (n: number | string) => `Check Box${n}`;

// Por característica: modificador, puntuación, y campo y casilla de la salvación
const ABILITY_FIELDS: Record<Ability, [number, number, number, number]> = {
  str: [21, 64, 91, 37], dex: [22, 66, 87, 33], con: [24, 67, 86, 32], int: [20, 63, 69, 4], wis: [23, 65, 75, 21], cha: [25, 68, 81, 26],
};
// Por habilidad: campo y casilla
const SKILL_FIELDS: Record<string, [number, number]> = {
  athletics: [92, 38], acrobatics: [88, 34], "sleight of hand": [89, 35], stealth: [90, 36], arcana: [70, 16], history: [71, 17],
  investigation: [72, 19], nature: [73, 20], religion: [74, 18], "animal handling": [76, 22], insight: [77, 23], medicine: [78, 25],
  perception: [79, 31], survival: [80, 24], deception: [82, 27], intimidation: [83, 28], performance: [84, 30], persuasion: [85, 29],
};
// Filas de ataques: nombre, bonificador, daño y notas
const ATTACK_ROWS = [[30, 31, 32, 33], [34, 35, 36, 37], [38, 39, 40, 41], [42, 43, 44, 45], [46, 47, 48, 49], [50, 51, 52, 53]];
// Espacios de conjuro por nivel: campo del total y casillas de gastados
const SLOT_FIELDS: Record<number, [number, number[]]> = {
  1: [112, [227, 228, 229, 230]], 2: [113, [231, 232, 233]], 3: [114, [234, 235, 236]], 4: [117, [237, 238, 239]], 5: [116, [240, 241, 242]],
  6: [115, [243, 244]], 7: [118, [245, 246]], 8: [119, [247]], 9: [120, [248]],
};
// Notas de cada fila de conjuros: la plantilla las numera sin orden
const SPELL_NOTES = [108, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 227, 228, 229, 230, 244, 231, 232, 233, 234, 235, 236];
const SPELL_ROWS = SPELL_NOTES.length;
// Casillas de concentración, ritual y material de una fila: están en tres bloques
const spellChecks = (row: number): [string, string, string] => {
  if (row < 7) return [C(`252.${row}`), C(`253.${row}`), C(`254.0.${row}`)];
  if (row < 20) return [C(`255.${row - 7}`), C(`256.${row - 7}`), C(`257.${row - 7}`)];
  return [C(`258.${row - 20}`), C(`259.${row - 20}`), C(`260.${row - 20}`)];
};

const MAX_FEAT_TEXT = 220;
const fmt = (n: number) => (n >= 0 ? `+${n}` : String(n));
const plain = (text: string) => text.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim();
const short = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

/** Parte unos bloques de texto en dos columnas parecidas, sin separar ningún bloque. */
export function twoColumns(blocks: string[]): [string, string] {
  const size = (b: string) => b.split("\n").length + 1;
  const total = blocks.reduce((sum, b) => sum + size(b), 0);
  let used = 0;
  let cut = blocks.length;
  for (let i = 0; i < blocks.length; i++) {
    used += size(blocks[i]);
    if (used >= total / 2) {
      cut = i + 1;
      break;
    }
  }
  return [blocks.slice(0, cut).join("\n\n"), blocks.slice(cut).join("\n\n")];
}

type SpellRow = { level: number; name: string; time: string; range: string; concentration: boolean; ritual: boolean; material: boolean; note: string };

function spellRows(input: PdfInput): SpellRow[] {
  const { derived: d, entries } = input;
  const seen = new Set<string>();
  const rows: SpellRow[] = [];
  const add = (ref: Ref, name: string | null, note: string) => {
    const key = refKey(ref);
    if (seen.has(key)) return;
    seen.add(key);
    const entry = entries.get(key);
    const data = entry?.data as SpellData | undefined;
    rows.push({
      level: data?.level ?? 0,
      name: name ?? (entry ? (entry.nameEs ?? entry.name) : ref.key.replace(/^[^:]*:/, "").split("|")[0]),
      time: data?.time ?? "",
      range: data?.range ?? "",
      concentration: !!data?.concentration,
      ritual: !!data?.ritual,
      material: !!data && /\bM\b/.test(data.components),
      note,
    });
  };
  for (const b of d.spells.blocks) {
    b.cantrips.forEach((c) => add(c.ref, c.name, b.name));
    b.prepared.forEach((ref) => add(ref, null, b.name));
    b.always.forEach((a) => add(a.spell.ref, a.spell.name, a.origin));
  }
  d.spells.other.forEach((o) => add(o.spell.ref, o.spell.name, o.origin));
  return rows.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, "es"));
}

export function sheetPdfValues(input: PdfInput): PdfValues {
  const { sheet, derived: d, entries, pools } = input;
  const text: Record<string, string> = {};
  const checked: string[] = [];
  const sizes: Record<string, number> = {};
  const set = (n: number | string, value: string | number | null | undefined) => {
    if (value !== null && value !== undefined && value !== "") text[T(n)] = String(value);
  };
  const check = (n: number | string, on: unknown) => {
    if (on) checked.push(C(n));
  };
  const small = (n: number | string, size: number) => {
    sizes[T(n)] = size;
  };
  const custom = customOf(sheet);
  type Line = (typeof sheet.inventory.items)[number];
  const dataOf = (line: Line) => (line.ref ? (entries.get(refKey(line.ref))?.data as ItemData | undefined) : undefined);
  const describe = (ref: Ref | null, max: number) => {
    const e = ref ? entries.get(refKey(ref)) : undefined;
    return e ? short(plain(e.descriptionEs || e.description), max) : "";
  };

  // Cabecera
  set(1, input.name);
  set(6, sheet.background.name);
  set(7, d.classes.map((c) => `${c.name} ${c.level}`).join(" / "));
  set(8, speciesLabel(sheet.species.name, sheet.lineage?.name));
  set(9, d.classes.flatMap((c) => (c.subclass ? [c.subclass] : [])).join(" / "));
  set(11, d.level);
  set(12, sheet.xp);

  // Combate
  set(13, d.ac);
  check(3, sheet.inventory.items.some((i) => i.equipped && dataOf(i)?.armor?.category === "shield"));
  set(14, d.hp.current);
  if (d.hp.temp) set(15, d.hp.temp);
  set(16, d.hp.max);
  const spent = pools.reduce((sum, p) => sum + p.used, 0);
  if (spent) set(18, spent);
  set(17, pools.map((p) => `${p.total}d${p.die}`).join("+"));
  set(19, fmt(d.proficiencyBonus));
  set(26, fmt(d.initiative));
  set(27, d.speed);
  const size = sheet.speciesChoices.size;
  set(28, size ? sizeName(size) : "");
  small(28, 9);
  check(11, sheet.heroicInspiration);

  // Características, salvaciones y habilidades
  for (const [ability, [mod, score]] of Object.entries(ABILITY_FIELDS) as [Ability, [number, number, number, number]][]) {
    set(mod, fmt(d.abilities[ability].mod));
    set(score, d.abilities[ability].score);
  }
  for (const save of d.saves) {
    const [, , field, box] = ABILITY_FIELDS[save.ability];
    set(field, fmt(save.total));
    check(box, save.proficient);
  }
  const skills = new Map(d.skills.map((s) => [s.id.toLowerCase(), s]));
  for (const [id, [field, box]] of Object.entries(SKILL_FIELDS)) {
    const skill = skills.get(id);
    if (!skill) continue;
    set(field, fmt(skill.total));
    check(box, skill.proficiency >= 1);
  }
  const perception = skills.get("perception");
  if (perception) set(29, 10 + perception.total);

  // Ataques: la plantilla junta daño y tipo
  d.attacks.slice(0, ATTACK_ROWS.length).forEach((a, i) => {
    const [name, bonus, damage, notes] = ATTACK_ROWS[i];
    set(name, a.name);
    set(bonus, fmt(a.bonus));
    set(damage, `${a.damage.replace(" (dos manos)", "")} ${a.damageType}`.trim());
    small(damage, 7);
    set(notes, [a.range, a.notes].filter(Boolean).join(" · "));
    small(notes, 6);
  });

  // Rasgos de clase en las dos columnas de la plantilla, con los usos y las acciones que aportan
  const groupText = (sources: Derived["features"][number]["source"][]) => d.features
    .filter((g) => sources.includes(g.source))
    .map((g) => [g.title, ...g.features.map((f) => `- ${f.name}${f.value ? ` (${f.value})` : ""}${f.chosen?.length ? `: ${f.chosen.join(", ")}` : ""}`)].join("\n"));
  const usesBlock = d.featureUses.length
    ? [["Usos", ...d.featureUses.map((u) => `- ${u.name}: ${u.max - u.used}/${u.max} (descanso ${u.recovery.short === "none" ? "largo" : "corto"})`)].join("\n")]
    : [];
  const actionNames = (group: "action" | "bonus" | "reaction") => [...new Set([
    ...input.actions.filter((a) => a.group === group && a.kind === "feature").map((a) => (a as { name: string }).name),
    ...input.itemActions.filter((a) => a.group === group).map((a) => a.name),
    ...custom.items.flatMap((c) => (c.kind === "action" && c.group === group ? [c.name] : [])),
  ])];
  const actionsBlock = ([["action", "Acciones"], ["bonus", "Acciones adicionales"], ["reaction", "Reacciones"]] as const)
    .flatMap(([group, title]) => {
      const names = actionNames(group);
      return names.length ? [`${title}: ${names.join(", ")}`] : [];
    });
  const [left, right] = twoColumns([...groupText(["class", "subclass", "option"]), ...usesBlock, ...actionsBlock]);
  set(54, left);
  set(55, right);
  small(54, 7);
  small(55, 7);

  // Especie, dotes y competencias
  const defenses = (kind: string, label: string) => {
    const rows = d.defenses.filter((r) => r.kind === kind).map((r) => (r.type === null ? "a elegir" : defenseTypeName(r.kind, r.type)));
    return rows.length ? [`${label}: ${rows.join(", ")}`] : [];
  };
  const states = [
    ...(sheet.conditions ?? []).map((c) => CONDITION_NAMES[c] ?? c),
    ...custom.conditions.filter((c) => c.active).map((c) => c.name),
    ...((sheet.exhaustion ?? 0) > 0 ? [`Agotamiento ${sheet.exhaustion}`] : []),
  ];
  set(57, [
    ...groupText(["species", "lineage"]),
    ...(d.darkvision ? [`Visión en la oscuridad ${d.darkvision} pies`] : []),
    ...defenses("resist", "Resistencias"), ...defenses("immune", "Inmunidades"), ...defenses("vulnerable", "Vulnerabilidades"), ...defenses("conditionImmune", "Inmune a estados"),
    ...(states.length ? [`Estados: ${states.join(", ")}`] : []),
  ].join("\n"));
  small(57, 7);
  const feats = d.features.filter((g) => g.source === "feat").flatMap((g) => g.features);
  set(58, feats.map((f) => `${f.name}: ${describe(f.ref, MAX_FEAT_TEXT)}`.replace(/: $/, "")).join("\n\n"));
  small(58, 6.5);
  check(13, d.armor.includes("light"));
  check(14, d.armor.includes("medium"));
  check(15, d.armor.includes("heavy"));
  check(12, d.armor.includes("shield"));
  set(59, d.weapons.map(proficiencyName).join(", "));
  small(59, 8);
  set(60, d.tools.map(toolName).join(", "));
  small(60, 7);

  // Lanzamiento de conjuros: una línea con todas las clases lanzadoras
  const blocks = d.spells.blocks;
  if (blocks.length) {
    set(111, blocks.map((b) => ABILITY_NAMES[b.ability]).join(" / "));
    set(93, blocks.map((b) => fmt(d.abilities[b.ability].mod)).join("/"));
    set(94, blocks.map((b) => b.dc).join("/"));
    set(95, blocks.map((b) => fmt(b.attack)).join("/"));
  }
  const { slots, used } = d.spells;
  for (const [level, [total, boxes]] of Object.entries(SLOT_FIELDS)) {
    const pact = slots.pact?.level === Number(level) ? slots.pact.count : 0;
    const count = (slots.levels[level] ?? 0) + pact;
    if (count) set(total, count);
    boxes.slice(0, used[level] ?? 0).forEach((box) => check(box, true));
  }
  const rows = spellRows(input);
  rows.slice(0, SPELL_ROWS).forEach((s, i) => {
    set(`105.${i}`, s.level || "T");
    set(`106.${i}`, s.name);
    set(`107.${i}`, s.time);
    small(`107.${i}`, 6);
    set(`109.${i}`, s.range);
    small(`109.${i}`, 6);
    set(SPELL_NOTES[i], s.note);
    small(SPELL_NOTES[i], 6);
    const [concentration, ritual, material] = spellChecks(i);
    if (s.concentration) checked.push(concentration);
    if (s.ritual) checked.push(ritual);
    if (s.material) checked.push(material);
  });
  if (rows.length > SPELL_ROWS) set(SPELL_NOTES[SPELL_ROWS - 1], `+${rows.length - SPELL_ROWS + 1} más`);

  // Trasfondo y notas
  set(96, [sheet.appearance, sheet.age ? `Edad: ${sheet.age}` : ""].filter(Boolean).join("\n"));
  small(96, 7);
  const titled = (title: string, value: string | undefined) => (value?.trim() ? `${title}: ${value.trim()}` : "");
  set(97, [
    input.backstory.trim(),
    titled("Personalidad", sheet.personality), titled("Ideales", sheet.ideals), titled("Vínculos", sheet.bonds), titled("Defectos", sheet.flaws),
    titled("Organizaciones", sheet.organizations), titled("Aliados", sheet.allies), titled("Enemigos", sheet.enemies),
    titled("Notas", sheet.notes), ...custom.notes.map((n) => titled(n.title, n.text)),
  ].filter(Boolean).join("\n\n"));
  small(97, 7);
  set(100, ALIGNMENTS.find((a) => a.id === sheet.alignment)?.name ?? sheet.alignment);
  set(98, d.languages.join(", "));
  small(98, 8);

  // Equipo: lo sintonizado va a sus tres huecos
  sheet.inventory.items.filter((i) => i.attuned).slice(0, 3).forEach((line, i) => {
    set(101 + i, line.name);
    check(249 + i, true);
  });
  set(99, [
    sheet.inventory.items.map((l) => `${l.quantity > 1 ? `${l.quantity}x ` : ""}${l.name}${l.equipped ? " (equipado)" : ""}`).join(", "),
    sheet.inventory.other,
    `Carga: ${d.weight.total}/${d.weight.capacity} lb`,
  ].filter(Boolean).join("\n\n"));
  small(99, 7);
  const { coins } = sheet.inventory;
  set(226, coins.cp);
  set(267, coins.sp);
  set(268, coins.ep);
  set(269, coins.gp);
  set(270, coins.pp);

  return { text, checked, sizes };
}
