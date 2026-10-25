import type { Metadata } from "next";
import DeleteAccountForm from "@/app/components/account/DeleteAccountForm";
import { requireUser } from "@/lib/server/auth/currentUser";

export const metadata: Metadata = { title: "Borrar cuenta" };

export default async function DeleteAccountPage() {
  const me = await requireUser("/settings/delete");
  return <DeleteAccountForm username={me.username} />;
}