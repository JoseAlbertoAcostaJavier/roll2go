// Conversión del texto de 5etools (`entries` y etiquetas `{@tag ...}`) al BBCode de la aplicación.

const DEFAULT_SOURCE = "xphb";

// Etiquetas que se convierten en una referencia `[ref=tipo:clave]`
const REF_TAGS: Record<string, string> = {
  spell: "spell",
  item: "item",
  feat: "feat",
  condition: "condition",
  race: "race",
  skill: "skill",
  sense: "sense",
  action: "action",
  variantrule: "variantrule",
  itemmastery: "itemMastery",
  itemproperty: "itemProperty",
  creature: "creature",
  status: "status",
  hazard: "hazard",
  table: "table",
  book: "book",
  filter: "filter",
  "5etools": "5etools",
};

const ATTACK_TYPES: Record<string, string> = {
  mw: "Ataque con arma cuerpo a cuerpo",
  rw: "Ataque con arma a distancia",
  ms: "Ataque de conjuro cuerpo a cuerpo",
  rs: "Ataque de conjuro a distancia",
};

const ABILITIES: Record<string, string> = {
  str: "Fuerza",
  dex: "Destreza",
  con: "Constitución",
  int: "Inteligencia",
  wis: "Sabiduría",
  cha: "Carisma",
};

const bold = (s: string) => `[b]${s}[/b]`;

function convertTag(name: string, rawArgs: string): string {
  const args = rawArgs.split("|").map((a) => a.trim());
  const first = args[0] ?? "";
  const tag = name.toLowerCase();

  switch (tag) {
    case "b":
    case "bold":
      return `[b]${rawArgs}[/b]`;
    case "i":
    case "italic":
    case "note":
      return `[i]${rawArgs}[/i]`;
    case "dice":
    case "damage":
    case "d":
      return bold(args[1] || first);
    case "dc":
      return bold(args[1] || `CD ${first}`);
    case "chance":
      return bold(args[1] || `${first} %`);
    case "hit":
      return bold(args[1] || `${/^[+-]/.test(first) ? "" : "+"}${first}`);
    case "scaledamage":
    case "scaledice":
      return bold(args[2] || first);
    case "h":
      return "Impacto: ";
    case "atk":
      return `${first.split(",").map((t) => ATTACK_TYPES[t.trim()]).filter(Boolean).join(" o ") || "Ataque"}: `;
  }

  const type = REF_TAGS[tag];
  if (type && first) {
    const source = (args[1] || DEFAULT_SOURCE).toLowerCase();
    // La clave va dentro de [ref=...], que no admite ] ni saltos de línea
    const key = `${first.toLowerCase()}|${source}`.replace(/[\]\n]/g, "");
    return `[ref=${type}:${key}]${args[2] || first}[/ref]`;
  }

  return first; // etiqueta desconocida: texto plano
}

// Convierte las etiquetas en línea `{@tag args}`, resolviendo de dentro hacia fuera las anidadas
export function inlineTags(s: string): string {
  const innermost = /\{@(\w+)(?:\s+([^{}]*))?\}/;
  let out = s;
  // Cada vuelta elimina una etiqueta; el tope evita bucles con datos raros
  for (let guard = 0; guard < 10000; guard++) {
    const m = innermost.exec(out);
    if (!m) break;
    out = out.slice(0, m.index) + convertTag(m[1], m[2] ?? "") + out.slice(m.index + m[0].length);
  }
  return out;
}

type Entry = Record<string, unknown>;
const isObj = (e: unknown): e is Entry => typeof e === "object" && e !== null && !Array.isArray(e);
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);

// Título en negrita; añade el punto final salvo que ya termine en puntuación
const heading = (name: string) => bold(/[.!?:]$/.test(name) ? name : `${name}.`);

function abilityList(attributes: unknown): string {
  const names = asArray(attributes).map((a) => ABILITIES[String(a)] ?? String(a));
  return names.join(" o ");
}

function cellText(cell: unknown): string {
  if (!isObj(cell)) return inlineTags(String(cell ?? ""));
  const roll = cell.roll;
  if (isObj(roll)) {
    if (typeof roll.exact === "number") return String(roll.exact);
    if (typeof roll.min === "number" && typeof roll.max === "number") return `${roll.min}-${roll.max}`;
  }
  if (cell.entry !== undefined) return cellText(cell.entry);
  return entriesToBbcode(asArray(cell.entries));
}

function tableToBbcode(t: Entry): string {
  const lines: string[] = [];
  if (typeof t.caption === "string") lines.push(bold(inlineTags(t.caption)));
  const labels = asArray(t.colLabels).map((l) => inlineTags(String(l)));
  if (labels.length) lines.push(bold(labels.join(" · ")));
  for (const row of asArray(t.rows)) {
    const cells = Array.isArray(row) ? row : isObj(row) ? asArray(row.row) : [];
    lines.push(cells.map(cellText).join(" · "));
  }
  return lines.join("\n");
}

function listToBbcode(l: Entry): string {
  const items = asArray(l.items)
    .map((it) => {
      if (isObj(it) && (it.type === "item" || it.type === "itemSub" || it.type === "itemSpell")) {
        const body = entriesToBbcode(asArray(it.entries ?? it.entry)).replace(/\n\n/g, "\n");
        const name = typeof it.name === "string" ? heading(inlineTags(it.name)) : "";
        return [name, body].filter(Boolean).join(" ");
      }
      return entryToBbcode(it).replace(/\n\n/g, "\n");
    })
    .filter((x) => x !== "")
    .map((x) => `[*]${x}`);
  return items.length ? `[list]\n${items.join("\n")}\n[/list]` : "";
}

// Bloque con nombre opcional: "[b]Nombre.[/b] texto" (en la misma línea si empieza por texto)
function namedBlock(e: Entry): string {
  const body = entriesToBbcode(asArray(e.entries));
  if (typeof e.name !== "string" || !e.name) return body;
  const head = heading(inlineTags(e.name));
  if (!body) return head;
  return `${head}${typeof asArray(e.entries)[0] === "string" ? " " : "\n\n"}${body}`;
}

function entryToBbcode(e: unknown): string {
  if (typeof e === "string") return inlineTags(e);
  if (typeof e === "number") return String(e);
  if (!isObj(e)) return "";

  switch (e.type) {
    case "list":
      return listToBbcode(e);
    case "table":
      return tableToBbcode(e);
    case "quote": {
      const text = entriesToBbcode(asArray(e.entries));
      const by = typeof e.by === "string" ? `\n— ${inlineTags(e.by)}` : "";
      return text ? `[i]${text}[/i]${by}` : "";
    }
    case "inline":
    case "inlineBlock":
      return asArray(e.entries).map(entryToBbcode).join("");
    case "refClassFeature":
    case "refSubclassFeature":
    case "refOptionalfeature":
    case "hr":
      return "";
    case "abilityDc":
      return `CD de salvación de conjuros = 8 + bonificador de competencia + modificador de ${abilityList(e.attributes)}`;
    case "abilityAttackMod":
      return `Modificador de ataque de conjuros = bonificador de competencia + modificador de ${abilityList(e.attributes)}`;
    case "item":
    case "itemSub":
    case "itemSpell": {
      // Fuera de una lista, un elemento con nombre se trata como un bloque con nombre
      const body = entriesToBbcode(asArray(e.entries ?? e.entry));
      const name = typeof e.name === "string" ? heading(inlineTags(e.name)) : "";
      return [name, body].filter(Boolean).join(" ");
    }
    default:
      // entries, section, inset, insetReadaloud, options y tipos desconocidos
      return namedBlock(e);
  }
}

// Convierte una lista de `entries` de 5etools en BBCode (bloques separados por una línea en blanco)
export function entriesToBbcode(entries: unknown[]): string {
  return entries
    .map(entryToBbcode)
    .filter((b) => b.trim() !== "")
    .join("\n\n");
}
