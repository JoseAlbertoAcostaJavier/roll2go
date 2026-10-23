/* Libros utilizables: visible ∩ (campaña si restringe) ∩ (chosen si no vacío y la campaña no restringe).
   Un filtro `chosen` sin ningún libro visible (ids ajenos o borrados) se ignora.
   Función pura, separada de catalog.ts para poder probarla sin cargar Next. */
export function pickBooks(input: {
  visible: string[];
  campaign: { restrictBooks: boolean; allowedBooks: string[] } | null;
  chosen: string[];
}): string[] {
  const { visible, campaign, chosen } = input;
  if (campaign?.restrictBooks) {
    const allowed = new Set(campaign.allowedBooks);
    return visible.filter((id) => allowed.has(id));
  }
  if (chosen.length > 0) {
    const wanted = new Set(chosen);
    const picked = visible.filter((id) => wanted.has(id));
    if (picked.length > 0) return picked;
  }
  return visible;
}
