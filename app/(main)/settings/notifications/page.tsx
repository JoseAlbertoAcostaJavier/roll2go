import type { Metadata } from "next";
import NotificationPrefsForm from "@/app/components/NotificationPrefsForm";
import { requireUser } from "@/lib/currentUser";
import { User } from "@/lib/User";

export const metadata: Metadata = { title: "Notificaciones" };

export default async function NotificationSettingsPage() {
  const me = await requireUser("/settings/notifications");
  const u = await User.findById(me.id).select("emailPrefs").lean();
  const p = u?.emailPrefs;

  return (
    <NotificationPrefsForm
      initial={{ campaigns: p?.campaigns ?? true, messages: p?.messages ?? false, social: p?.social ?? true }}
    />
  );
}