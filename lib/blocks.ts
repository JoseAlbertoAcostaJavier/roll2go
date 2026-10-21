import { Block } from "@/lib/Block";

// Estado del bloqueo entre dos usuarios: ¿he bloqueado yo?, ¿me ha bloqueado él?
export async function blockStatus(meId: string, otherId: string) {
  const rows = await Block.find({
    $or: [
      { blocker: meId, blocked: otherId },
      { blocker: otherId, blocked: meId },
    ],
  })
    .select("blocker")
    .lean();
  const byMe = rows.some((r) => String(r.blocker) === meId);
  const byThem = rows.some((r) => String(r.blocker) === otherId);
  return { byMe, byThem, any: byMe || byThem };
}

export async function isBlockedEither(a: string, b: string) {
  return (await blockStatus(a, b)).any;
}

// Ids de todos los usuarios con los que hay un bloqueo, en cualquier dirección
export async function blockedIdsOf(meId: string): Promise<string[]> {
  const rows = await Block.find({ $or: [{ blocker: meId }, { blocked: meId }] })
    .select("blocker blocked")
    .lean();
  return rows.map((r) =>
    String(r.blocker) === meId ? String(r.blocked) : String(r.blocker),
  );
}
