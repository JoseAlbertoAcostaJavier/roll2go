// Conjuros que ya tiene o ha elegido en otra fuente (`libro:clave`): un mismo conjuro no se elige en dos sitios.
// Función pura, la usan el creador y el asistente de subir de nivel.

/** Un conjuro tomado: `label: null` ⇒ lo tiene por otra vía; con texto, la fuente en la que ya se eligió. */
export type GrantedSpell = { key: string; label: string | null };

/**
 * Los conjuros tomados que ve la fuente `except`: los de `base` (especie, linaje, clase…) y los elegidos en cada una de
 * las demás fuentes de `picks`. Una clave repetida conserva la primera.
 */
export function crossSourceGranted(
  base: string[],
  picks: { source: string; label: string; keys: string[] }[],
  except: string,
): GrantedSpell[] {
  const out: GrantedSpell[] = [];
  const seen = new Set<string>();
  const add = (key: string, label: string | null) => {
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ key, label });
  };
  for (const key of base) add(key, null);
  for (const p of picks) if (p.source !== except) for (const key of p.keys) add(key, p.label);
  return out;
}
