import { Friendship, pairKey } from "@/lib/Friendship";
import { User } from "@/lib/User";

export type Relation = "none" | "friend" | "outgoing" | "incoming";
const USERNAME_REGEX = /^[A-Za-z0-9_]{3,20}$/;

export function relationOf(
  meId: string,
  f: { requester: unknown; status: string } | null,
): Relation {
  if (!f) return "none";
  if (f.status === "accepted") return "friend";
  return String(f.requester) === meId ? "outgoing" : "incoming";
}

export async function relationBetween(
  meId: string,
  otherId: string,
): Promise<Relation> {
  const f = await Friendship.findOne({ pair: pairKey(meId, otherId) })
    .select("requester status")
    .lean();
  return relationOf(meId, f);
}

// Relación con varias personas a la vez (para los resultados de búsqueda)
export async function relationsWith(meId: string, otherIds: string[]) {
  const rows = await Friendship.find({
    pair: { $in: otherIds.map((o) => pairKey(meId, o)) },
  })
    .select("requester recipient status")
    .lean();
  const map = new Map<string, Relation>();
  for (const r of rows) {
    const other =
      String(r.requester) === meId ? String(r.recipient) : String(r.requester);
    map.set(other, relationOf(meId, r));
  }
  return map;
}

export async function findUserByUsername(username: string) {
  if (!USERNAME_REGEX.test(username)) return null;
  return User.findOne({ usernameLower: username.toLowerCase(), verified: true })
    .select("username displayName avatarId")
    .lean();
}

// Ids de los amigos de un usuario (amistades aceptadas)
export async function friendIdsOf(meId: string): Promise<string[]> {
  const rows = await Friendship.find({ status: "accepted", $or: [{ requester: meId }, { recipient: meId }] })
    .select("requester recipient")
    .limit(500)
    .lean();
  return rows.map((r) => (String(r.requester) === meId ? String(r.recipient) : String(r.requester)));
}