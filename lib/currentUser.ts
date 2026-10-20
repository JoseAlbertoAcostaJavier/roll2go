import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { COOKIE_NAME, verifySession } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/lib/User";

export type CurrentUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: "user" | "admin";
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return null;

  await connectDB();
  const u = await User.findById(session.id)
    .select("username displayName avatarId role")
    .lean();
  if (!u) return null; // la cuenta ya no existe
  return {
    id: String(u._id),
    username: u.username,
    displayName: u.displayName || u.username, // sin nombre visible, se muestra el usuario
    avatarUrl: u.avatarId ? `/api/images/${u.avatarId}` : null,
    role: u.role === "admin" ? "admin" : "user",
  };
});

// Para las páginas que exigen sesión: sin ella, al login (y de vuelta aquí al entrar)
export async function requireUser(next: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign_in?next=${encodeURIComponent(next)}`);
  return user;
}

// Solo administradores. Al resto les da 404, para no revelar que la página existe
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") notFound();
  return user;
}
