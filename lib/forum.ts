import { cleanText } from "@/lib/utils";

export const REACTIONS = [
  { emoji: "👍", label: "Me gusta" },
  { emoji: "❤️", label: "Me encanta" },
  { emoji: "😂", label: "Me divierte" },
  { emoji: "😮", label: "Me sorprende" },
  { emoji: "😢", label: "Me entristece" },
  { emoji: "🎲", label: "¡Buena tirada!" },
] as const;

// Reacciones de un mensaje: cuántas hay de cada emoji, si tú has puesto cada una y los nombres de los demás
export type ReactionState = Record<string, { count: number; mine: boolean; names: string[] }>;
export const MAX_REACTION_NAMES = 10; // nombres que se muestran al pasar el ratón; el resto, "y N más"

// "Tú, Ana y 2 más": quién ha reaccionado, para el texto que aparece al pasar el ratón
export function reactionWho(r: { count: number; mine: boolean; names: string[] }) {
  const people = [...(r.mine ? ["Tú"] : []), ...r.names];
  const rest = r.count - people.length;
  if (rest > 0) people.push(`${rest} más`);
  if (people.length <= 1) return people.join("");
  return `${people.slice(0, -1).join(", ")} y ${people[people.length - 1]}`;
}

export const LIKE = "👍";
export const REACTION_EMOJIS: string[] = REACTIONS.map((r) => r.emoji);

export const MAX_TITLE = 120;
export const MAX_CONTENT = 10000;
export const THREADS_PER_PAGE = 15;
export const REPLIES_PER_PAGE = 30;


// Valida un mensaje del foro (el servidor repite las comprobaciones del navegador)
export function parseForumBody(body: { title?: unknown; content?: unknown }, isRoot: boolean) {
  const title = isRoot && typeof body.title === "string" ? cleanText(body.title).replace(/\s+/g, " ").trim() : "";
  const content = typeof body.content === "string" ? cleanText(body.content).trim() : "";

  const errors: Record<string, string> = {};
  if (isRoot && (title.length < 1 || title.length > MAX_TITLE)) {
    errors.title = `El título es obligatorio (máximo ${MAX_TITLE} caracteres).`;
  }
  if (!content) errors.content = "Escribe el mensaje.";
  else if (content.length > MAX_CONTENT) errors.content = `El mensaje es demasiado largo (máximo ${MAX_CONTENT} caracteres).`;

  return { errors, value: { title, content } };
}