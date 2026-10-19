import type { Metadata } from "next";
import AccountForms from "@/app/components/AccountForms";
import { requireUser } from "@/lib/currentUser";
import { User } from "@/lib/User";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function AccountSettingsPage() {
  const me = await requireUser("/settings/account");
  const u = await User.findById(me.id).select("email +pendingEmail").lean();

  return <AccountForms username={me.username} email={u?.email ?? ""} pendingEmail={u?.pendingEmail ?? null} />;
}