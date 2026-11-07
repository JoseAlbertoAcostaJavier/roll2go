/** Avatar de los personajes sin retrato: las dos primeras letras del nombre («Sheggen» → «SH»). Sin nombre, «?». */
export function initialsOf(name: string): string {
  // Array.from separa por caracteres completos: no parte emojis ni tildes compuestas
  const letters = Array.from(name.trim().replace(/\s+/g, "")).slice(0, 2);
  return letters.length ? letters.join("").toLocaleUpperCase("es") : "?";
}
