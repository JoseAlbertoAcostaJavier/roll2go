import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/server/auth/currentUser";
import { loadCreatorPage } from "@/lib/server/characters/queries";
import { system as rpgSystems } from "@/lib/utils/systems";
import { first } from "@/lib/utils/utils";
import CharacterCreator from "@/app/components/characters/creator/CharacterCreator";

export const metadata: Metadata = { title: "Nuevo personaje" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NewCharacterPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const systemId = first(sp.system) ?? "";
  const campaignId = first(sp.campaign) ?? "";
  const booksParam = (first(sp.books) ?? "").slice(0, 2000);

  const here = new URLSearchParams({ system: systemId });
  if (campaignId) here.set("campaign", campaignId);
  if (booksParam) here.set("books", booksParam);
  const user = await requireUser(`/characters/new?${here.toString()}`);

  const system = rpgSystems.find((s) => s.id === systemId);
  if (!system?.creator) notFound();

  // La campaña tiene que ser del mismo sistema y admitir personajes internos; si no eres miembro, 404
  const chosen = booksParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 50);
  const page = await loadCreatorPage(user.id, { systemId, campaignId, chosenBooks: chosen });
  if (!page) notFound();
  const { campaign } = page;
  // Dotes, rasgos opcionales y armas con maestría: para las elecciones de nivel 1 de la clase (las listas de conjuros
  // las pide el creador al elegir la clase)
  const { species, lineages, classes, backgrounds, feats, optionalFeatures, weapons, languages, choiceItems } = page.lists;

  const back = campaign ? `/campaigns/${campaign.id}/characters` : "/characters";

  return (
    <div className="mx-auto max-w-280 px-5 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-extrabold">Nuevo personaje</h1>
          <nav aria-label="Ruta de navegación" className="mt-1 flex flex-wrap items-center gap-x-2 text-xs uppercase text-muted">
            <span className="text-brand-soft">{system.name}</span>
            <span aria-hidden="true">/</span>
            {campaign && (
              <>
                <Link href="/campaigns" className="text-brand-soft hover:underline">Campañas</Link>
                <span aria-hidden="true">/</span>
                <Link href={`/campaigns/${campaign.id}`} className="text-brand-soft hover:underline">{campaign.name}</Link>
                <span aria-hidden="true">/</span>
              </>
            )}
            <Link href={back} className="text-brand-soft hover:underline">Personajes</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Añadir</span>
          </nav>
        </div>
        <Link href={back} className="flex items-center gap-1 text-sm text-muted hover:text-white">
          <ChevronLeft size={16} aria-hidden="true" /> Volver
        </Link>
      </header>

      <CharacterCreator
        systemId={systemId}
        campaign={campaign}
        chosenBooks={chosen}
        species={species}
        lineages={lineages}
        classes={classes}
        backgrounds={backgrounds}
        feats={feats}
        optionalFeatures={optionalFeatures}
        weapons={weapons}
        languages={languages}
        choiceItems={choiceItems}
      />
    </div>
  );
}
