// Empareja los datos de Foundry (`foundry-*.json`) con las entradas normalizadas.
import type { EntryKind } from "../types";
import type { NormalizedEntry } from "./normalize";

type Rec = Record<string, unknown>;

/** Archivos de Foundry ya leídos; cada lista se asocia a los tipos de entrada que puede completar. */
export type FoundryFiles = {
  feats?: { feat?: unknown[] };
  items?: { item?: unknown[]; baseitem?: unknown[] };
  races?: { race?: unknown[] };
  backgrounds?: { background?: unknown[] };
  classes?: { class?: unknown[]; subclass?: unknown[]; classFeature?: unknown[]; subclassFeature?: unknown[] };
  spells?: { spell?: unknown[] };
};

const isObj = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const s = (v: unknown) => (typeof v === "string" ? v : "");

/** Mismo criterio que las claves del normalizador, sin el tipo delante y en minúsculas. */
function bareKey(kind: EntryKind, o: Rec): string {
  const name = s(o.name);
  const source = s(o.source);
  const suffix = (own: string) => (own.toLowerCase() === source.toLowerCase() ? "" : `|${source}`);
  switch (kind) {
    case "subclass":
      return `${name}|${s(o.className)}|${s(o.classSource)}${suffix(s(o.classSource))}`.toLowerCase();
    case "classFeature":
      return `${name}|${s(o.className)}|${s(o.classSource)}|${String(o.level)}${suffix(s(o.classSource))}`.toLowerCase();
    case "subclassFeature":
      return [name, o.className, o.classSource, o.subclassShortName, o.subclassSource, o.level]
        .map(String).join("|").toLowerCase() + suffix(s(o.subclassSource)).toLowerCase();
    default:
      return `${name}|${source}`.toLowerCase();
  }
}

/** Lista de objetos de Foundry por tipo de entrada. */
function listsByKind(f: FoundryFiles): [EntryKind, unknown[]][] {
  return [
    ["feat", f.feats?.feat ?? []],
    ["item", [...(f.items?.baseitem ?? []), ...(f.items?.item ?? [])]],
    ["species", f.races?.race ?? []],
    ["background", f.backgrounds?.background ?? []],
    ["class", f.classes?.class ?? []],
    ["subclass", f.classes?.subclass ?? []],
    ["classFeature", f.classes?.classFeature ?? []],
    ["subclassFeature", f.classes?.subclassFeature ?? []],
    ["spell", f.spells?.spell ?? []],
  ];
}

/**
 * Devuelve `clave de la entrada → objeto de Foundry` (sin `name` ni `source`) para las entradas que tienen pareja.
 */
export function matchFoundry(entries: NormalizedEntry[], files: FoundryFiles): Map<string, Rec> {
  const out = new Map<string, Rec>();
  for (const [kind, list] of listsByKind(files)) {
    const byBare = new Map<string, Rec>();
    for (const o of list) if (isObj(o)) byBare.set(bareKey(kind, o), o);
    for (const e of entries) {
      if (e.kind !== kind) continue;
      const found = byBare.get(e.key.slice(kind.length + 1));
      if (!found) continue;
      const { name: _name, source: _source, ...rest } = found; // eslint-disable-line @typescript-eslint/no-unused-vars
      out.set(e.key, rest);
    }
  }
  return out;
}
