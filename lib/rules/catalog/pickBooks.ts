/** Sigla del libro de reglas básicas: siempre disponible, lo restrinja o no la campaña o el personaje. */
export const CORE_BOOK_KEY = "XPHB";

/* Libros utilizables: visible ∩ (campaña si restringe) ∩ (chosen si no vacío y la campaña no restringe), más los de `core`.
   Un filtro `chosen` sin ningún libro visible (ids ajenos o borrados) se ignora.
   Función pura, separada de catalog.ts para poder probarla sin cargar Next. */
export function pickBooks(input: {
  visible: string[];
  campaign: { restrictBooks: boolean; allowedBooks: string[] } | null;
  chosen: string[];
  core?: string[];
}): string[] {
  const { visible, campaign, chosen } = input;
  const core = new Set(input.core ?? []);
  const keep = (wanted: Set<string>) => visible.filter((id) => wanted.has(id) || core.has(id));
  if (campaign?.restrictBooks) return keep(new Set(campaign.allowedBooks));
  if (chosen.length > 0) {
    const wanted = new Set(chosen);
    if (visible.some((id) => wanted.has(id))) return keep(wanted);
  }
  return visible;
}
