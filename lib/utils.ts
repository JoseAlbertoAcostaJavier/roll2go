// Utilidades pequeñas compartidas por páginas y rutas de la API

// Primer valor de un parámetro de la dirección (?a=1&a=2 llega como array)
export const first = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);

// Número de página de ?page=, siempre entre 1 y `pages`
export const pageFrom = (v: string | string[] | undefined, pages: number) =>
  Math.min(Math.max(parseInt(first(v) ?? "1", 10) || 1, 1), pages);

// Quita los caracteres de control (salvo tabulador y saltos de línea)
export const cleanText = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

// Escapa un texto para usarlo dentro de una expresión regular (búsquedas en MongoDB)
export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
