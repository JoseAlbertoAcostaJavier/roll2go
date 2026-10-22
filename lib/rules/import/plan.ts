// Plan de importación: qué entradas se escriben y cuáles se borran del libro, sin tocar la base de datos.
import type { NormalizedEntry } from "./normalize";

export type ImportPlan = {
  upserts: NormalizedEntry[];
  /** Claves existentes en el libro que ya no llegan (o que `--srd-only` deja fuera). */
  deletes: string[];
};

/**
 * `existingKeys`: claves que el libro tiene ahora en la base de datos. Con `srdOnly` solo se importan las entradas
 * `srd52`; las que ya existían y quedan fuera se borran, igual que cualquiera que ya no llegue en la fuente.
 */
export function planImport(
  existingKeys: string[],
  incoming: NormalizedEntry[],
  opts: { srdOnly: boolean },
): ImportPlan {
  const upserts = opts.srdOnly ? incoming.filter((e) => e.srd52) : incoming;
  const keep = new Set(upserts.map((e) => e.key));
  return { upserts, deletes: existingKeys.filter((k) => !keep.has(k)) };
}
