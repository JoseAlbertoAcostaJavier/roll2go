/**
 * Parámetros de una lista tras cambiar un filtro: parte de `base` (sin modificarlo), quita el parámetro si el valor
 * es el vacío o el de por defecto, y vuelve a la primera página (se quita `page`).
 */
export function nextListQuery(
  base: URLSearchParams,
  change: { name: string; value: string; defaultValue: string },
): URLSearchParams {
  const params = new URLSearchParams(base);
  if (change.value === "" || change.value === change.defaultValue) params.delete(change.name);
  else params.set(change.name, change.value);
  params.delete("page");
  return params;
}
