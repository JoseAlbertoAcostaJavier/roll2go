import type { Metadata } from "next";
import NotificationPrefsForm, { type Prefs } from "@/app/components/NotificationPrefsForm";
import { requireUser } from "@/lib/currentUser";
import { User } from "@/lib/User";
import { CAMPAIGN_EMAIL_PREFS, wantsEmail, type EmailPrefs } from "@/lib/notificationText";

export const metadata: Metadata = { title: "Notificaciones" };

export default async function NotificationSettingsPage() {
  const me = await requireUser("/settings/notifications");
  const u = await User.findById(me.id).select("emailPrefs").lean();
  const p = u?.emailPrefs as EmailPrefs | undefined;

  const initial: Prefs = {
    messages: wantsEmail(p, "messages"),
    social: wantsEmail(p, "social"),
    campaignTypes: Object.fromEntries(
      CAMPAIGN_EMAIL_PREFS.map(({ key }) => [key, wantsEmail(p, key)]),
    ) as Prefs["campaignTypes"],
  };
  return <NotificationPrefsForm initial={initial} />;
}
