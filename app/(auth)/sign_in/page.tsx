import type { Metadata } from "next";
import AuthShell from "@/app/components/AuthShell";
import LoginForm from "@/app/components/LoginForm";

export const metadata: Metadata = { title: "Iniciar sesión - Roll2Go" };

export default function LoginPage() {
  return (
    <AuthShell>
      <LoginForm />
    </AuthShell>
  );
}