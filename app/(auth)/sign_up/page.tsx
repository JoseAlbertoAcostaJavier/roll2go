import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthShell from "@/app/components/AuthShell";
import RegisterForm from "@/app/components/RegisterForm";
import { getCurrentUser } from "@/lib/currentUser";


export const metadata: Metadata = { title: "Crear cuenta" };

export default async function RegisterPage() {
  // Si ya tiene sesión (y su cuenta sigue existiendo), no tiene sentido ver el sign up
  if (await getCurrentUser()) redirect("/");

  return (
    <AuthShell>
      <RegisterForm />
    </AuthShell>
  );
}