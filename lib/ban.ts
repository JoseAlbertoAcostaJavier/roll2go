import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/lib/User";

/* Comprobar el baneo en cada petición costaría una consulta, así que el resultado se recuerda unos
   segundos por servidor. Al banear se borra al momento en este servidor; en los demás, como mucho
   tarda TTL_MS en notarse. */
const TTL_MS = 30_000;
const MAX_ENTRIES = 5_000;
const cache = new Map<string, { banned: boolean; until: number }>();

export async function isBanned(userId: string) {
  const hit = cache.get(userId);
  if (hit && hit.until > Date.now()) return hit.banned;
  if (!mongoose.isValidObjectId(userId)) return false;

  try {
    await connectDB();
    const banned = !!(await User.exists({ _id: userId, bannedAt: { $ne: null } }));
    if (cache.size >= MAX_ENTRIES) cache.clear();
    cache.set(userId, { banned, until: Date.now() + TTL_MS });
    return banned;
  } catch (err) {
    // Si la base de datos falla, no se cierra la sesión a nadie (la petición fallará igualmente)
    console.error("Error al comprobar el baneo:", err);
    return false;
  }
}

// Tras banear o quitar el baneo, para que el cambio se note ya en este servidor
export function forgetBan(userId: string) {
  cache.delete(userId);
}
