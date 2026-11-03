// Evaluador de las fórmulas de usos de Foundry («@scale.barbarian.rages», «max(1,@abilities.cha.mod)»…). Parser
// recursivo propio, sin eval ni Function: cualquier cosa fuera de la gramática o de las variables conocidas da `null`.
import type { Ability } from "@/lib/rules/types";

export type UsesVars = {
  prof: number;
  mods: Record<Ability, number>;
  /** Nivel por clase, con el nombre desnudo de la clase («barbarian»). */
  classLevels: Record<string, number>;
  /** Valor numérico de la columna de la tabla de clase al nivel actual en esa clase; `null` si no hay. */
  scale: (cls: string, column: string) => number | null;
};

const TOKEN = /\s*(?:(\d+(?:\.\d+)?)|(@\w+(?:\.\w+|-(?![A-Za-z]\w*\()[A-Za-z]\w*)*)|([A-Za-z]+)|([-+*/(),]))/y;
// `arity`: número exacto de argumentos; sin él, uno o más
const FUNCTIONS: Record<string, { arity?: number; run: (args: number[]) => number }> = {
  max: { run: (a) => Math.max(...a) },
  min: { run: (a) => Math.min(...a) },
  floor: { arity: 1, run: (a) => Math.floor(a[0]) },
};
// Anidamiento máximo de paréntesis, signos y funciones
const MAX_DEPTH = 32;
const ABILITIES = new Set<string>(["str", "dex", "con", "int", "wis", "cha"]);

type Token = { kind: "num" | "var" | "name" | "op"; text: string };

function tokenize(src: string): Token[] | null {
  const out: Token[] = [];
  let at = 0;
  while (at < src.length) {
    TOKEN.lastIndex = at;
    const m = TOKEN.exec(src);
    if (!m) return /^\s*$/.test(src.slice(at)) ? out : null;
    at = TOKEN.lastIndex;
    if (m[1] !== undefined) out.push({ kind: "num", text: m[1] });
    else if (m[2] !== undefined) out.push({ kind: "var", text: m[2].slice(1) });
    else if (m[3] !== undefined) out.push({ kind: "name", text: m[3] });
    else out.push({ kind: "op", text: m[4] });
  }
  return out;
}

function variable(path: string, vars: UsesVars): number | null {
  const [head, ...rest] = path.split(".");
  if (head === "prof" && rest.length === 0) return vars.prof;
  if (head === "abilities" && rest.length === 2 && rest[1] === "mod" && ABILITIES.has(rest[0])) return vars.mods[rest[0] as Ability];
  if (head === "classes" && rest.length === 2 && rest[1] === "levels") return vars.classLevels[rest[0]] ?? 0;
  if (head === "scale" && rest.length >= 2) return vars.scale(rest[0], rest.slice(1).join("."));
  return null;
}

class Unknown extends Error {}

/** Evalúa `formula`; `null` si usa algo desconocido, está mal formada o no da un número finito. Redondea hacia abajo. */
export function evalUses(formula: string, vars: UsesVars): number | null {
  const tokens = tokenize(formula);
  if (!tokens || tokens.length === 0) return null;
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (t: Token | undefined, ...ops: string[]) => t?.kind === "op" && ops.includes(t.text);
  const fail = (): never => { throw new Unknown(); };

  const expr = (): number => {
    let v = term();
    while (isOp(peek(), "+", "-")) v = tokens[pos++].text === "+" ? v + term() : v - term();
    return v;
  };
  const term = (): number => {
    let v = factor();
    while (isOp(peek(), "*", "/")) {
      const mul = tokens[pos++].text === "*";
      const r = factor();
      if (!mul && r === 0) fail();
      v = mul ? v * r : v / r;
    }
    return v;
  };
  let depth = 0;
  const factor = (): number => {
    if (++depth > MAX_DEPTH) fail();
    try {
      return atom();
    } finally {
      depth--;
    }
  };
  const atom = (): number => {
    const t = tokens[pos++];
    if (!t) return fail();
    if (t.kind === "num") return Number(t.text);
    if (t.kind === "var") return variable(t.text, vars) ?? fail();
    if (isOp(t, "-")) return -factor();
    if (isOp(t, "(")) {
      const v = expr();
      if (!isOp(tokens[pos++], ")")) fail();
      return v;
    }
    if (t.kind === "name" && Object.hasOwn(FUNCTIONS, t.text)) {
      if (!isOp(tokens[pos++], "(")) fail();
      const args = [expr()];
      while (isOp(peek(), ",")) { pos++; args.push(expr()); }
      if (!isOp(tokens[pos++], ")")) fail();
      const fn = FUNCTIONS[t.text];
      if (fn.arity !== undefined && args.length !== fn.arity) fail();
      return fn.run(args);
    }
    return fail();
  };

  try {
    const v = expr();
    if (pos !== tokens.length || !Number.isFinite(v)) return null;
    return Math.floor(v);
  } catch (e) {
    if (e instanceof Unknown) return null;
    throw e;
  }
}
