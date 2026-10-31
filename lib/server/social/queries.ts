import "server-only";
// Datos de la página social y del buscador de usuarios
import { connectDB } from "@/lib/models/mongodb";
import { Block } from "@/lib/models/Block";
import { Friendship } from "@/lib/models/Friendship";
import { User } from "@/lib/models/User";
import { loadUserCards } from "@/lib/server/account/userCards";
import { fail, type Result } from "@/lib/server/result";
import { blockedIdsOf } from "@/lib/server/social/blocks";
import { relationOf, relationsWith, type Relation } from "@/lib/server/social/friends";
import { escapeRegex } from "@/lib/utils/utils";

export type SocialPerson = { username: string; displayName: string; avatarUrl: string | null; relation: Relation };

/* Usuarios verificados cuyo @usuario o nombre visible empieza por `q` (nunca por correo), sin ti ni nadie con quien
   haya un bloqueo, con tu relación con cada uno. Como mucho 8. */
export async function searchUsers(meId: string, q: string): Promise<Result<{ users: SocialPerson[] }>> {
  try {
    await connectDB();
    const prefix = new RegExp("^" + escapeRegex(q));
    const hidden = await blockedIdsOf(meId); // bloqueados en cualquier dirección
    const users = await User.find({
      verified: true,
      _id: { $nin: [meId, ...hidden] },
      $or: [{ usernameLower: prefix }, { displayNameLower: prefix }],
    })
      .select("username displayName avatarId")
      .sort({ usernameLower: 1 })
      .limit(8)
      .lean();

    const relations = await relationsWith(meId, users.map((u) => String(u._id)));
    return {
      ok: true,
      users: users.map((u) => ({
        username: u.username,
        displayName: u.displayName || u.username,
        avatarUrl: u.avatarId ? `/api/images/${u.avatarId}` : null,
        relation: relations.get(String(u._id)) ?? "none",
      })),
    };
  } catch (err) {
    console.error("Error en la búsqueda de usuarios:", err);
    return fail(500, "No se pudo buscar. Inténtalo de nuevo.");
  }
}

/* Página social: amigos y solicitudes (las 300 más recientes, sin cuentas borradas) y los usuarios que has
   bloqueado (los 200 más recientes). */
export async function socialOverview(meId: string) {
  await connectDB();
  const rows = await Friendship.find({ $or: [{ requester: meId }, { recipient: meId }] })
    .sort({ updatedAt: -1 })
    .limit(300)
    .lean();
  const otherIds = rows.map((r) => (String(r.requester) === meId ? String(r.recipient) : String(r.requester)));
  const users = await User.find({ _id: { $in: otherIds } }).select("username displayName avatarId").lean();
  const byId = new Map(users.map((u) => [String(u._id), u] as const));

  const people: SocialPerson[] = [];
  rows.forEach((r, i) => {
    const u = byId.get(otherIds[i]);
    if (!u) return; // cuenta borrada
    people.push({
      username: u.username,
      displayName: u.displayName || u.username,
      avatarUrl: u.avatarId ? `/api/images/${u.avatarId}` : null,
      relation: relationOf(meId, r),
    });
  });

  const blocks = await Block.find({ blocker: meId }).sort({ createdAt: -1 }).limit(200).lean();
  const blockedCards = await loadUserCards(blocks.map((b) => b.blocked));
  const blockedUsers = blocks.map((b) => blockedCards.get(String(b.blocked))).filter((u) => !!u);
  return { people, blockedUsers };
}
