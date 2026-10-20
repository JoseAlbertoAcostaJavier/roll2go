import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthShell from "@/app/components/AuthShell";
import LoginForm from "@/app/components/LoginForm";
import { safeRedirect } from "@/lib/auth";
import { getCurrentUser } from "@/lib/currentUser";

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