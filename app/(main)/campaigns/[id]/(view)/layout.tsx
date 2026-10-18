import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Pencil } from "lucide-react";
import CampaignTabs from "@/app/components/CampaignTabs";
import { getCampaignAccess } from "@/lib/campaignAccess";
import { system as rpgSystems } from "@/lib/systems";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { campaign } = await getCampaignAccess(id);
  return { title: campaign.name };
}

/* Cabecera y pestañas compartidas por Detalles, Personajes y Diario de campaña.
   El layout no se vuelve a ejecutar al cambiar de pestaña, así que cada página comprueba el acceso por su cuenta. */
export default async function CampaignLayout({
  children,
  params,
}: Props & { children: React.ReactNode }) {
  const { id } = await params;
  const { campaign, isDm } = await getCampaignAccess(id);
  const systemName = rpgSystems.find((s) => s.id === campaign.systemId)?.name ?? campaign.systemId;

  return (
    <div className="mx-auto max-w-280 px-5 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {campaign.logoId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/images/${campaign.logoId}`} alt="" className="h-16 w-16 rounded-md object-cover" />
          )}
          <div>
            <h1 className="font-heading text-3xl font-extrabold uppercase">{campaign.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs uppercase text-muted">
              <span className="text-brand-soft">{systemName}</span>
              <span aria-hidden="true">/</span>
              <Link href="/campaigns" className="text-brand-soft hover:underline">Campañas</Link>
              <span aria-hidden="true">/</span>
              <span>{campaign.name}</span>
              {campaign.status === "inactive" && <span className="ml-2 rounded bg-surface px-2 py-0.5">Inactiva</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/campaigns" className="flex items-center gap-1 text-sm text-muted hover:text-white">
            <ChevronLeft size={16} aria-hidden="true" /> Listado
          </Link>
          {isDm && (
            <Link
              href={`/campaigns/${id}/edit`}
              className="flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-hover"
            >
              <Pencil size={14} aria-hidden="true" /> Editar
            </Link>
          )}
        </div>
      </header>

      <CampaignTabs base={`/campaigns/${id}`} />
      <div className="rounded-b-lg border border-t-0 border-line bg-panel p-5 sm:p-6">{children}</div>
    </div>
  );
}