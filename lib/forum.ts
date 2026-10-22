export const REACTIONS = [
  { emoji: "👍", label: "Me gusta" },
  { emoji: "❤️", label: "Me encanta" },
  { emoji: "😂", label: "Me divierte" },
  { emoji: "😮", label: "Me sorprende" },
  { emoji: "😢", label: "Me entristece" },
  { emoji: "🎲", label: "¡Buena tirada!" },
] as const;

// Reacciones de un mensaje: cuántas hay de cada emoji y si tú has puesto cada una
export type ReactionState = Record<string, { count: number; mine: boolean }>;

export const LIKE = "👍";
export const REACTION_EMOJIS: string[] = REACTIONS.map((r) => r.emoji);

export const MAX_TITLE = 120;
export const MAX_CONTENT = 10000;
export const THREADS_PER_PAGE = 15;
export const REPLIES_PER_PAGE = 30;

const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

// Valida un mensaje del foro (el servidor repite las comprobaciones del navegador)
export function parseForumBody(body: { title?: unknown; content?: unknown }, isRoot: boolean) {
  const title = isRoot && typeof body.title === "string" ? clean(body.title).replace(/\s+/g, " ").trim() : "";
  const content = typeof body.content === "string" ? clean(body.content).trim() : "";

  const errors: Record<string, string> = {};
  if (isRoot && (title.length < 1 || title.length > MAX_TITLE)) {
    errors.title = `El título es obligatorio (máximo ${MAX_TITLE} caracteres).`;
  }
  if (!content) errors.content = "Escribe el mensaje.";
  else if (content.length > MAX_CONTENT) errors.content = `El mensaje es demasiado largo (máximo ${MAX_CONTENT} caracteres).`;

  return { errors, value: { title, content } };
}