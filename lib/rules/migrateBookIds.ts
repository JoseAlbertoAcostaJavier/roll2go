import mongoose from "mongoose";
import { LEGACY_BOOK_KEYS } from "@/lib/rules/books";

/* Convierte una lista de ids de libro: los ObjectId válidos se dejan, los ids antiguos se
   sustituyen por el _id del Book oficial (idByKey: sigla -> _id) y el resto se descarta. */
export function convertBookIds(
  ids: string[],
  idByKey: Map<string, string>,
): { ids: string[]; dropped: string[] } {
  const out = new Set<string>();
  const dropped: string[] = [];
  for (const id of ids) {
    if (mongoose.isValidObjectId(id)) {
      out.add(id);
      continue;
    }
    const key = LEGACY_BOOK_KEYS[id];
    const newId = key ? idByKey.get(key) : undefined;
    if (newId) out.add(newId);
    else dropped.push(id);
  }
  return { ids: [...out], dropped };
}
