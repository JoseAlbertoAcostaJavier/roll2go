import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import CampaignForm from "@/app/components/CampaignForm";
import { COOKIE_NAME, verifySession } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/lib/User";
import { system as rpgSystems } from "@/lib/systems";
import { officialBooksOf } from "@/lib/rules/books";

export const metadata: Metadata = { title: "Crear campaña" };

export default async function NewCampaignPage() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect("/sign_in?next=/campaigns/new");

  await connectDB();
  const me = await User.findById(session.id).select("ownedBooks").lean();
  const books = (await Promise.all(rpgSystems.map((s) => officialBooksOf(s.id)))).flat();

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="mb-6 font-heading text-3xl font-extrabold">Crear campaña</h1>
      <CampaignForm
        systems={rpgSystems.map((s) => ({ id: s.id, name: s.name }))}
        books={books}
        ownedBooks={me?.ownedBooks ?? []}
      />
    </div>
  );
}