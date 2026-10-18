// Valida los datos de una nota del diario (el servidor repite las comprobaciones del navegador)
export function parseLogBody(body: {
  title?: unknown;
  content?: unknown;
  visibility?: unknown;
}) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content : "";
  const visibility = body.visibility;

  const errors: Record<string, string> = {};
  if (title.length < 1 || title.length > 120)
    errors.title = "El título es obligatorio (máximo 120 caracteres).";
  if (!content.trim()) errors.content = "Escribe el contenido de la nota.";
  else if (content.length > 50000)
    errors.content = "La nota es demasiado larga.";
  if (visibility !== "public" && visibility !== "private")
    errors.visibility = "Elige si la nota es pública o privada.";

  return {
    errors,
    value: { title, content, visibility: visibility as "public" | "private" },
  };
}
