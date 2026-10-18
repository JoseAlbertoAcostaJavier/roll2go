import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import CampaignForm from "@/app/components/CampaignForm";
import DeleteCampaign from "@/app/components/DeleteCampaign";
import { getCampaignAccess } from "@/lib/campaignAccess";
import { Campaign } from "@/lib/Campaign";
import { User } from "@/lib/User";
import { system as rpgSystems } from "@/lib/systems";
import { books } from "@/lib/books";

export const metadata: Metadata = { title: "Editar campaña" };

export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, isDm } = await getCampaignAccess(id);
  if (!isDm) redirect(`/campaigns/${id}`); // los jugadores no pueden editar

  // Aquí sí se cargan las notas privadas: solo las ve el DM
  const full = await Campaign.findOne({ _id: id, owner: session.id }).select("+privateNotes").lean();
  if (!full) notFound();

  // Los libros ya aprobados se mantienen visibles aunque el DM ya no los tenga en su perfil
  const me = await User.findById(session.id).select("ownedBooks").lean();
  const owned = [...new Set<string>([...(me?.ownedBooks ?? []), ...(full.allowedBooks ?? [])])];

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link href={`/campaigns/${id}`} className="mb-4 flex w-max items-center gap-1 text-sm text-muted hover:text-white">
        <ChevronLeft size={16} aria-hidden="true" /> Volver a la campaña
      </Link>
      
      {/* Contenedor Flex para alinear el título y el botón en la misma fila */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-3xl font-extrabold">Editar campaña</h1>
        <DeleteCampaign campaignId={id} campaignName={full.name} />
      </div>

      <CampaignForm
        mode="edit"
        campaignId={id}
        systems={rpgSystems.map((s) => ({ id: s.id, name: s.name }))}
        books={books}
        ownedBooks={owned}
        initial={{
          name: full.name,
          systemId: full.systemId,
          status: full.status,
          shortDescription: full.shortDescription ?? "",
          description: full.description ?? "",
          privateNotes: full.privateNotes ?? "",
          restrictBooks: !!full.restrictBooks,
          allowedBooks: [...(full.allowedBooks ?? [])],
          allowCharacters: full.characters?.allowed ?? true,
          allowInternal: full.characters?.internal ?? true,
          allowExternal: full.characters?.external ?? true,
          imageUrl: full.imageId ? `/api/images/${full.imageId}` : null,
          logoUrl: full.logoId ? `/api/images/${full.logoId}` : null,
        }}
      />
    </div>
  );
}