import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import CampaignForm from "@/app/components/CampaignForm";
import { COOKIE_NAME, verifySession } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { system as rpgSystems } from "@/lib/systems";
import { visibleBooksOf } from "@/lib/rules/books";

export const metadata: Metadata = { title: "Crear campaña" };

export default async function NewCampaignPage() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect("/sign_in?next=/campaigns/new");

  await connectDB();
  const books = await visibleBooksOf(session.id);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="mb-6 font-heading text-3xl font-extrabold">Crear campaña</h1>
      <CampaignForm
        systems={rpgSystems.map((s) => ({ id: s.id, name: s.name }))}
        books={books}
      />
    </div>
  );
}