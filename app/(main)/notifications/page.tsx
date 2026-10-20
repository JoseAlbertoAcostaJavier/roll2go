import type { Metadata } from "next";
import NotificationList from "@/app/components/NotificationList";
import { requireUser } from "@/lib/currentUser";

export const metadata: Metadata = { title: "Notificaciones" };

export default async function NotificationsPage() {
  await requireUser("/notifications");
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="mb-6 font-heading text-3xl font-extrabold">Notificaciones</h1>
      <NotificationList />
    </div>
  );
}