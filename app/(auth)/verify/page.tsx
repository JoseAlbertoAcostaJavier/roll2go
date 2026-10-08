import type { Metadata } from "next";
import AuthShell from "@/app/components/AuthShell";
import VerifyPending from "@/app/components/VerifyPending";

export const metadata: Metadata = { title: "Verifica tu correo" };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return (
    <AuthShell>
      <VerifyPending initialEmail={typeof email === "string" ? email.slice(0, 254) : ""} />
    </AuthShell>
  );
}