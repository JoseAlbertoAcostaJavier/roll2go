import type { Metadata } from "next";
import AuthShell from "@/app/components/AuthShell";
import ResetPasswordForm from "@/app/components/ResetPasswordForm";

export const metadata: Metadata = { title: "Nueva contraseña" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthShell>
      <ResetPasswordForm token={typeof token === "string" ? token : ""} />
    </AuthShell>
  );
}