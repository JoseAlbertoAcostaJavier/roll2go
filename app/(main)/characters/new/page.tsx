import type { Metadata } from "next";
import Link from "next/link";
import mongoose from "mongoose";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { connectDB } from "@/lib/models/mongodb";
import { Campaign } from "@/lib/models/Campaign";
import { requireUser } from "@/lib/server/auth/currentUser";
import { system as rpgSystems } from "@/lib/utils/systems";
import { first } from "@/lib/utils/utils";
import { NotFoundError, listEntries, listMasteryWeapons, usableBooks, type EntryOption } from "@/lib/server/catalog/catalog";
import type { SpeciesData } from "@/lib/rules/types";
import CharacterCreator from "@/app/components/characters/CharacterCreator";

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
  let campaign: { id: string; name: string } | null = null;
  if (campaignId) {
    if (!mongoose.isValidObjectId(campaignId)) notFound();
    await connectDB();
    const doc = await Campaign.findOne({ _id: campaignId, members: user.id })
      .select("name systemId characters")
      .lean();
    if (!doc || doc.systemId !== systemId || !(doc.characters?.allowed === true && doc.characters?.internal === true)) notFound();
    campaign = { id: campaignId, name: doc.name };
  }

  const chosen = booksParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 50);
  let books: string[];
  try {
    books = await usableBooks({ userId: user.id, systemId, campaignId: campaignId || undefined, chosenBooks: chosen });
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }

  // Dotes, rasgos opcionales y armas con maestría: para las elecciones de nivel 1 de la clase (las listas de conjuros
  // las pide el creador al elegir la clase)
  const [species, classes, backgrounds, feats, optionalFeatures, weapons] = await Promise.all([
    listEntries({ books, kind: "species" }),
    listEntries({ books, kind: "class" }),
    listEntries({ books, kind: "background" }),
    listEntries({ books, kind: "feat" }),
    listEntries({ books, kind: "optionalFeature" }),
    listMasteryWeapons(books),
  ]);
  // Legados de cada especie que los tiene (del mismo libro que la especie), por "libro:clave" de la especie
  const lineages: Record<string, EntryOption[]> = {};
  await Promise.all(
    species
      .filter((s) => (s.data as SpeciesData | null)?.hasLineages)
      .map(async (s) => {
        const list = await listEntries({ books, kind: "lineage", parent: s.ref.key });
        lineages[`${s.ref.book}:${s.ref.key}`] = list.filter((l) => l.ref.book === s.ref.book);
      }),
  );

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
      />
    </div>
  );
}
