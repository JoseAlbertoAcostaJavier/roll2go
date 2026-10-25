import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthShell from "@/app/components/layout/AuthShell";
import LoginForm from "@/app/components/auth/LoginForm";
import { safeRedirect } from "@/lib/server/auth/auth";
import { getCurrentUser } from "@/lib/server/auth/currentUser";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // "next" es la página privada a la que quería entrar el usuario (la pone proxy.ts)
  const { next } = await searchParams;
  const redirectTo = safeRedirect(next);

  // Si ya tiene sesión (y su cuenta sigue existiendo), no tiene sentido ver el login
  if (await getCurrentUser()) redirect(redirectTo);

  return (
    <AuthShell>
      <LoginForm redirectTo={redirectTo} />
    </AuthShell>
  );
}