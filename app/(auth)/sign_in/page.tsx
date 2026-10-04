import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AuthShell from "@/app/components/AuthShell";
import LoginForm from "@/app/components/LoginForm";
import { COOKIE_NAME, verifySession, safeRedirect } from "@/lib/auth";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // "next" es la página privada a la que quería entrar el usuario (la pone proxy.ts)
  const { next } = await searchParams;
  const redirectTo = safeRedirect(next);

  // Si ya tiene sesión, no tiene sentido ver el login
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (token && (await verifySession(token))) redirect(redirectTo);

  return (
    <AuthShell>
      <LoginForm redirectTo={redirectTo} />
    </AuthShell>
  );
}