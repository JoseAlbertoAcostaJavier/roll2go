import "server-only";
import { OUTDATED_SHEET_ERROR, loadCharacterFor } from "@/lib/server/characters/characterAccess";
import { fail } from "@/lib/server/result";

/** Personaje para escribir en su hoja (solo el dueño), o el fallo: 404 si no existe o no es suyo; 409 si la hoja no
 *  está al día. */
export async function loadForWrite(userId: string, id: string) {
  const found = await loadCharacterFor(userId, id, "write");
  if (!found) return { failure: fail(404, "Personaje no encontrado.") };
  if (found.outdated) return { failure: fail(409, OUTDATED_SHEET_ERROR) };
  return { found };
}
