import type { Metadata } from "next";
import AuthShell from "@/app/components/layout/AuthShell";
import VerifyConfirm from "@/app/components/auth/VerifyConfirm";

export const metadata: Metadata = { title: "Confirmar cuenta" };

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthShell>
      <VerifyConfirm token={typeof token === "string" ? token : ""} />
    </AuthShell>
  );
}