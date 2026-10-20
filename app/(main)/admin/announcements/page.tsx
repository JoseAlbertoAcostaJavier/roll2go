import type { Metadata } from "next";
import AnnouncementForm from "@/app/components/AnnouncementForm";
import { requireAdmin } from "@/lib/currentUser";

export const metadata: Metadata = { title: "Avisos de Roll2Go" };

export default async function AnnouncementsPage() {
  await requireAdmin(); // a quien no es administrador le da 404
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="mb-6 font-heading text-3xl font-extrabold">Avisos de Roll2Go</h1>
      <AnnouncementForm />
    </div>
  );
}