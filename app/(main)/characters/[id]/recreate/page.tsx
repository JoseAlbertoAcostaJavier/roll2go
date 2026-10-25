import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Campaign } from "@/lib/models/Campaign";
import { requireUser } from "@/lib/server/auth/currentUser";
import { loadCharacterFor } from "@/lib/server/characters/characterAccess";
import { listEntries, listMasteryWeapons, type EntryOption } from "@/lib/server/catalog/catalog";
import { creationDraft } from "@/lib/rules/dnd2024/recreate";
import type { SpeciesData } from "@/lib/rules/types";
import CharacterCreator from "@/app/components/characters/CharacterCreator";

export const metadata: Metadata = { title: "Rehacer creación" };

export default async function RecreateCharacterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/characters/${id}/recreate`);
  // Solo el dueño, con la hoja al día y a nivel 1
  const found = await loadCharacterFor(user.id, id, "write");
  if (!found || found.outdated) notFound();
  if (found.sheet.levels.length !== 1) redirect(`/characters/${id}/edit`);
  const { character: c, sheet, books } = found;

  const campaignDoc = c.campaign ? await Campaign.findById(c.campaign).select("name").lean() : null;
  const campaign = campaignDoc ? { id: String(c.campaign), name: campaignDoc.name as string } : null;

  // Las mismas listas que en el alta, con los libros del personaje (las de conjuros, bajo demanda)
  const [species, classes, backgrounds, feats, optionalFeatures, weapons] = await Promise.all([
    listEntries({ books, kind: "species" }),
    listEntries({ books, kind: "class" }),
    listEntries({ books, kind: "background" }),
    listEntries({ books, kind: "feat" }),
    listEntries({ books, kind: "optionalFeature" }),
    listMasteryWeapons(books),
  ]);
  const lineages: Record<string, EntryOption[]> = {};
  await Promise.all(
    species
      .filter((s) => (s.data as SpeciesData | null)?.hasLineages)
      .map(async (s) => {
        const list = await listEntries({ books, kind: "lineage", parent: s.ref.key });
        lineages[`${s.ref.book}:${s.ref.key}`] = list.filter((l) => l.ref.book === s.ref.book);
      }),
  );

  const initial = creationDraft(
    { name: c.name, pronouns: (c.pronouns ?? []) as string[], status: c.status, backstory: c.backstory ?? "" },
    sheet,
  );

  return (
    <div className="mx-auto max-w-280 px-5 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-extrabold">Rehacer creación</h1>
          <p className="mt-1 text-sm text-muted">{c.name}</p>
        </div>
        <Link href={`/characters/${id}/edit`} className="flex items-center gap-1 text-sm text-muted hover:text-white">
          <ChevronLeft size={16} aria-hidden="true" /> Volver
        </Link>
      </header>

      <CharacterCreator
        systemId={c.systemId}
        campaign={campaign}
        chosenBooks={books}
        species={species}
        lineages={lineages}
        classes={classes}
        backgrounds={backgrounds}
        feats={feats}
        optionalFeatures={optionalFeatures}
        weapons={weapons}
        recreate={{ characterId: id, initial }}
      />
    </div>
  );
}
