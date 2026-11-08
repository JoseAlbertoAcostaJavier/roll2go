import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/server/auth/currentUser";
import { loadCharacterFor } from "@/lib/server/characters/characterAccess";
import { campaignRefOf, loadCreatorLists } from "@/lib/server/characters/queries";
import { creationDraft } from "@/lib/rules/dnd2024/creation/recreate";
import CharacterCreator from "@/app/components/characters/creator/CharacterCreator";

export const metadata: Metadata = { title: "Rehacer creación" };

export default async function RecreateCharacterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/characters/${id}/recreate`);
  // Solo el dueño, con la hoja al día y a nivel 1
  const found = await loadCharacterFor(user.id, id, "write");
  if (!found || found.outdated) notFound();
  if (found.sheet.levels.length !== 1) redirect(`/characters/${id}/edit`);
  const { character: c, sheet, books } = found;

  const campaign = await campaignRefOf(c);

  // Las mismas listas que en el alta, con los libros del personaje (las de conjuros, bajo demanda)
  const { species, lineages, levelOneSubclasses, classes, backgrounds, feats, optionalFeatures, weapons, languages, choiceItems } = await loadCreatorLists(books);

  const initial = creationDraft(
    { name: c.name, pronouns: (c.pronouns ?? []) as string[], status: c.status, backstory: c.backstory ?? "" },
    sheet,
  );

  return (
    <div className="mx-auto max-w-300 px-5 py-8">
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
        levelOneSubclasses={levelOneSubclasses}
        classes={classes}
        backgrounds={backgrounds}
        feats={feats}
        optionalFeatures={optionalFeatures}
        weapons={weapons}
        languages={languages}
        choiceItems={choiceItems}
        recreate={{ characterId: id, initial }}
      />
    </div>
  );
}
