import type { Metadata } from "next";
import NotificationPrefsForm, { type Prefs } from "@/app/components/account/NotificationPrefsForm";
import { requireUser } from "@/lib/server/auth/currentUser";
import { emailPrefsOf } from "@/lib/server/account/settings";
import { CAMPAIGN_EMAIL_PREFS, wantsEmail } from "@/lib/shared/notificationText";

export const metadata: Metadata = { title: "Notificaciones" };

export default async function NotificationSettingsPage() {
  const me = await requireUser("/settings/notifications");
  const p = await emailPrefsOf(me.id);

  const initial: Prefs = {
    messages: wantsEmail(p, "messages"),
    social: wantsEmail(p, "social"),
    campaignTypes: Object.fromEntries(
      CAMPAIGN_EMAIL_PREFS.map(({ key }) => [key, wantsEmail(p, key)]),
    ) as Prefs["campaignTypes"],
  };
  return <NotificationPrefsForm initial={initial} />;
}
