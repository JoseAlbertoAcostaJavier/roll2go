import "server-only";
import { connectDB } from "@/lib/models/mongodb";
import { User } from "@/lib/models/User";
import { escapeRegex, pageFrom } from "@/lib/utils/utils";

export const USERS_PER_PAGE = 20;
export type UserFilter = "all" | "warned" | "banned";

type Warning = { reason: string; createdAt: Date };

/* Usuarios de la página pedida para el panel de administración, los más nuevos primero. Búsqueda por el principio
   del @usuario o del nombre visible (los dos campos en minúsculas tienen índice). */
export async function listUsers(q: string, filterId: UserFilter, pageParam: string | string[] | undefined) {
  const filter: Record<string, unknown> = {};
  if (q) {
    const prefix = new RegExp("^" + escapeRegex(q.toLowerCase()));
    filter.$or = [{ usernameLower: prefix }, { displayNameLower: prefix }];
  }
  if (filterId === "banned") filter.bannedAt = { $ne: null };
  if (filterId === "warned") filter["warnings.0"] = { $exists: true };

  await connectDB();
  const total = await User.countDocuments(filter);
  const pages = Math.max(1, Math.ceil(total / USERS_PER_PAGE));
  const page = pageFrom(pageParam, pages);
  const docs = await User.find(filter)
    .select("username displayName email verified createdAt avatarId role warnings bannedAt banReason")
    .sort({ createdAt: -1 })
    .skip((page - 1) * USERS_PER_PAGE)
    .limit(USERS_PER_PAGE)
    .lean();

  const users = docs.map((u) => ({
    id: String(u._id),
    username: u.username as string,
    displayName: (u.displayName || u.username) as string,
    avatarUrl: u.avatarId ? `/api/images/${u.avatarId}` : null,
    email: u.email as string,
    verified: !!u.verified,
    isAdmin: u.role === "admin",
    createdAt: new Date(u.createdAt),
    bannedAt: u.bannedAt ? new Date(u.bannedAt) : null,
    banReason: (u.banReason ?? "") as string,
    warnings: [...((u.warnings ?? []) as Warning[])].reverse(), // la más reciente primero
  }));
  return { total, pages, page, users };
}
