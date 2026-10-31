import type { Metadata } from "next";
import AccountForms from "@/app/components/account/AccountForms";
import { requireUser } from "@/lib/server/auth/currentUser";
import { accountEmails } from "@/lib/server/account/settings";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function AccountSettingsPage() {
  const me = await requireUser("/settings/account");
  const { email, pendingEmail } = await accountEmails(me.id);

  return <AccountForms username={me.username} email={email} pendingEmail={pendingEmail} />;
}