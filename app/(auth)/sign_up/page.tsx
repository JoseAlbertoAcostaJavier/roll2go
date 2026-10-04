import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AuthShell from "@/app/components/AuthShell";
import RegisterForm from "@/app/components/RegisterForm";
import { COOKIE_NAME, verifySession } from "@/lib/auth";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function RegisterPage() {
  // Si ya tiene sesión, no tiene sentido ver el registro
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (token && (await verifySession(token))) redirect("/");

  return (
    <AuthShell>
      <RegisterForm />
    </AuthShell>
  );
}