import { connectDB } from "@/lib/mongodb";
import { User } from "@/lib/User";

export type UserCard = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

// Datos públicos (nombre, usuario y foto) de varios usuarios a la vez. Las cuentas borradas no aparecen.
export async function loadUserCards(
  ids: unknown[],
): Promise<Map<string, UserCard>> {
  const unique = [...new Set(ids.map(String))];
  if (unique.length === 0) return new Map();
  await connectDB();
  const users = await User.find({ _id: { $in: unique } })
    .select("username displayName avatarId")
    .lean();
  return new Map(
    users.map((u): [string, UserCard] => [
      String(u._id),
      {
        id: String(u._id),
        username: u.username,
        displayName: u.displayName || u.username,
        avatarUrl: u.avatarId ? `/api/images/${u.avatarId}` : null,
      },
    ]),
  );
}
