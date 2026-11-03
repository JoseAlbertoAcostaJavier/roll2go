// Usos de los rasgos con contador («Furia □□ / Descanso largo»): el máximo y la recuperación salen de la tabla propia
// `USES` y, si el rasgo no está en ella, de los datos de Foundry del catálogo (`uses.max` y `uses.recovery`).
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import { refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import type { Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet/sheet";
import type { ClassData } from "@/lib/rules/types";
import type { FeatureGroup } from "./features";
import { evalUses, type UsesVars } from "./usesFormula";

export type { UsesVars } from "./usesFormula";
export { evalUses } from "./usesFormula";

/** `short`: qué vuelve con un descanso corto (`number` = cuántos usos). Un descanso largo lo devuelve todo. */
export type Recovery = { long: "all"; short: "all" | "none" | number };
export type FeatureUse = { key: string; name: string; max: number; used: number; recovery: Recovery };

type UsesRule = {
  /** Fórmula del máximo; si falta, la de Foundry. */
  max?: string;
  /** Si falta, la de Foundry (y sin ella, solo descanso largo). */
  recovery?: Recovery;
  /** Desde este nivel en la clase del rasgo, un descanso corto lo devuelve todo. */
  shortFrom?: { level: number };
};

const LONG: Recovery = { long: "all", short: "none" };

/**
 * Reservas propias, por clave del rasgo sin libro (`classFeature:rage|barbarian|xphb|1`). Ganan sobre Foundry, que no
 * trae la recuperación de Furia ni de varios rasgos de Guerrero, o su máximo no sale de la tabla de clase.
 */
export const USES: Record<string, UsesRule> = {
  "classFeature:rage|barbarian|xphb|1": { max: "@scale.barbarian.rages", recovery: { long: "all", short: 1 } },
  "classFeature:second wind|fighter|xphb|1": { max: "@scale.fighter.second-wind", recovery: { long: "all", short: 1 } },
  // Foundry da `@scale.fighter.action-surge`, que no es una columna de la tabla
  "classFeature:action surge|fighter|xphb|2": { max: "1 + floor(@classes.fighter.levels / 17)", recovery: { long: "all", short: "all" } },
  "classFeature:indomitable|fighter|xphb|9": {
    max: "1 + min(floor(@classes.fighter.levels / 13), 1) + min(floor(@classes.fighter.levels / 17), 1)", recovery: LONG,
  },
  "species:orc|xphb": { max: "1", recovery: LONG },
  "classFeature:arcane recovery|wizard|xphb|1": { max: "1", recovery: LONG },
  "classFeature:bardic inspiration|bard|xphb|1": { max: "max(1,@abilities.cha.mod)", recovery: LONG, shortFrom: { level: 5 } },
};

/** Nombres de columna de Foundry que difieren del id de la tabla de clase (`clase.columna` → id de la columna). */
export const SCALE_ALIASES: Record<string, string> = {
  "bard.inspiration": "bardic-die",
  "druid.wild-shape-uses": "wild-shape",
  "monk.focus": "focus-points",
  "monk.die": "martial-arts",
};

const NUMERIC_CELL = /^[+-]?\d+$/;

/** Valor numérico de la columna `column` de la tabla de `cls` al nivel `level`; `null` si falta o no es un número. */
export function scaleValue(data: ClassData | undefined, cls: string, column: string, level: number): number | null {
  const id = SCALE_ALIASES[`${cls}.${column}`] ?? column;
  const cell = data?.table?.columns.find((c) => c.id === id)?.values[level - 1];
  return cell !== undefined && NUMERIC_CELL.test(cell.trim()) ? Number(cell) : null;
}

const asString = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : null);

type FoundryUses = { max: string | null; recovery: { period?: string; type?: string; formula?: string }[] | null };

function foundryUses(entry: CatalogEntry | undefined): FoundryUses {
  const system = (entry?.foundry as { system?: Record<string, unknown> } | null | undefined)?.system;
  const recovery = system?.["uses.recovery"];
  return {
    max: asString(system?.["uses.max"]),
    recovery: Array.isArray(recovery) ? recovery.filter((r) => typeof r === "object" && r !== null) : null,
  };
}

function foundryRecovery(list: NonNullable<FoundryUses["recovery"]>, vars: UsesVars): Recovery {
  let short: Recovery["short"] = "none";
  for (const r of list) {
    if (r.period !== "sr") continue;
    if (r.type === "recoverAll") short = "all";
    else if (r.type === "formula" && r.formula) {
      const n = evalUses(r.formula, vars);
      if (n !== null && n > 0 && short !== "all") short = n;
    }
  }
  return { long: "all", short };
}

// Rasgos de los grupos sin repetir: los de especie y legado son el propio grupo, y los que suben con el nivel
// («Indomitable» 9, 13 y 17) cuentan una vez, con la clave de la primera aparición
function featuresOf(groups: FeatureGroup[]): { ref: FeatureGroup["features"][number]["ref"]; name: string }[] {
  const seen = new Set<string>();
  const out: { ref: FeatureGroup["features"][number]["ref"]; name: string }[] = [];
  for (const g of groups) {
    const list = g.features.length === 0 && g.ref && (g.source === "species" || g.source === "lineage")
      ? [{ ref: g.ref, name: g.title }] : g.features;
    for (const f of list) {
      const sig = `${f.ref.book}:${f.ref.key.replace(/\|\d+$/, "")}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push(f);
    }
  }
  return out;
}

/** Variables de las fórmulas: la columna de la tabla de clase se lee al nivel actual en esa clase. */
export function usesVars(
  base: Pick<UsesVars, "prof" | "mods">,
  classes: { name: string; level: number; data: ClassData | undefined }[],
): UsesVars {
  const byName = new Map(classes.map((c) => [c.name, c]));
  return {
    ...base,
    classLevels: Object.fromEntries(classes.map((c) => [c.name, c.level])),
    scale: (cls, column) => {
      const c = byName.get(cls);
      return c ? scaleValue(c.data, cls, column, c.level) : null;
    },
  };
}

export function featureUses(
  sheet: Dnd2024SheetV2,
  entries: Map<string, CatalogEntry>,
  groups: FeatureGroup[],
  vars: UsesVars,
): FeatureUse[] {
  const out: FeatureUse[] = [];
  for (const f of featuresOf(groups)) {
    const rule = USES[f.ref.key];
    const foundry = foundryUses(entries.get(refKey(f.ref)));
    const formula = rule?.max ?? foundry.max;
    const max = formula === null ? null : evalUses(formula, vars);
    if (max === null || max < 1) continue;
    let recovery: Recovery = rule?.recovery ?? (foundry.recovery ? foundryRecovery(foundry.recovery, vars) : LONG);
    if (rule?.shortFrom) {
      // La clase del rasgo: «classFeature:bardic inspiration|bard|xphb|1» → bard
      const cls = f.ref.key.split("|")[1];
      if ((vars.classLevels[cls] ?? 0) >= rule.shortFrom.level) recovery = { long: "all", short: "all" };
    }
    const key = refKey(f.ref);
    out.push({ key, name: f.name, max, used: Math.min(sheet.featureUses?.[key] ?? 0, max), recovery });
  }
  return out;
}
