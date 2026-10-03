import type { Metadata } from "next";
import AuthShell from "@/app/components/AuthShell";
import RegisterForm from "@/app/components/RegisterForm";

export const metadata: Metadata = { title: "Crear cuenta - Roll2Go" };

export default function RegisterPage() {
  return (
    <AuthShell>
      <RegisterForm />
    </AuthShell>
  );
}