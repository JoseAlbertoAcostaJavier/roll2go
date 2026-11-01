// Lista cada rasgo de clase y subclase del XPHB con su activación calculada, para revisar las correcciones de
// `ACTIVATION_OVERRIDES`. No escribe en la base de datos.
// Uso: npx tsx scripts/report-activation.ts --data <carpeta data de 5etools> [--only bonus,reaction,action,pasivo]
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { ACTIVATION_OVERRIDES, activationFor, featureActivation } from "../lib/rules/import/activation";
import { classFeatureKeyOf, subclassFeatureKeyOf } from "../lib/rules/import/normalize";

type Raw = Record<string, unknown>;

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

let data = "";
let only: string[] = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--data") data = argv[++i] ?? "";
  else if (argv[i] === "--only") only = (argv[++i] ?? "").split(",").map((k) => k.trim()).filter(Boolean);
  else fail(`Argumento desconocido: ${argv[i]}`);
}
if (!data) fail("Falta --data <carpeta data de 5etools>.");
const dir = path.join(data, "class");
if (!existsSync(dir)) fail(`No existe la carpeta: ${dir}`);

const rows: { key: string; text?: string; final?: string; entries: unknown }[] = [];
for (const f of readdirSync(dir).filter((f) => /^class-.*\.json$/.test(f)).sort()) {
  const file = JSON.parse(readFileSync(path.join(dir, f), "utf8")) as { classFeature?: Raw[]; subclassFeature?: Raw[] };
  for (const [list, keyOf] of [[file.classFeature, classFeatureKeyOf], [file.subclassFeature, subclassFeatureKeyOf]] as const) {
    for (const raw of list ?? []) {
      if (raw.source !== "XPHB") continue;
      const key = keyOf(raw);
      rows.push({ key, text: featureActivation(raw.entries), final: activationFor(key, raw.entries), entries: raw.entries });
    }
  }
}

const label = (a?: string) => a ?? "pasivo";
const count = (pick: (r: (typeof rows)[number]) => string | undefined) => {
  const c: Record<string, number> = {};
  for (const r of rows) c[label(pick(r))] = (c[label(pick(r))] ?? 0) + 1;
  return c;
};

for (const r of rows) {
  if (only.length && !only.includes(label(r.final))) continue;
  const note = r.key in ACTIVATION_OVERRIDES ? `  [corregido; el texto daba ${label(r.text)}]` : "";
  console.log(`${label(r.final).padEnd(8)} ${r.key}${note}`);
}
console.log(`\nRasgos XPHB: ${rows.length}`);
console.log("Solo texto:     ", count((r) => r.text));
console.log("Con correcciones:", count((r) => r.final));
