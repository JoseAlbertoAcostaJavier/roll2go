// Avatar de los personajes sin retrato: iniciales y un tono estable que sale del nombre.

/** «Theren Teinithra» → «TT»; con una sola palabra, sus dos primeras letras («Sheggen» → «SH»). Sin nombre, «?». */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  // Array.from separa por caracteres completos: no parte tildes compuestas ni emojis
  const letters = words.length > 1 ? [Array.from(words[0])[0], Array.from(words[1])[0]] : Array.from(words[0]).slice(0, 2);
  return letters.join("").toLocaleUpperCase("es");
}

/** Pares de fondo y texto oscuros y apagados; todos superan 4,5:1. */
export const AVATAR_TONES = [
  "bg-[#3a2a1c] text-[#f0c99a]",
  "bg-[#1f3330] text-[#9fdccf]",
  "bg-[#22304a] text-[#a9c8f5]",
  "bg-[#35264a] text-[#cfb3f2]",
  "bg-[#3d2230] text-[#f2b0cb]",
  "bg-[#2e3320] text-[#cfdc9a]",
] as const;

/** Tono del avatar: el mismo nombre da siempre el mismo. */
export function avatarTone(name: string): (typeof AVATAR_TONES)[number] {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.codePointAt(0)!) % 2147483647;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}
