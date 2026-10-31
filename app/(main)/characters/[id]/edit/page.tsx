import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, RotateCcw } from "lucide-react";
import { requireUser } from "@/lib/server/auth/currentUser";
import { loadCharacterFor } from "@/lib/server/characters/characterAccess";
import { bareName, refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import { parsePronouns } from "@/lib/rules/dnd2024/creation/names";
import CharacterEditForm from "@/app/components/characters/CharacterEditForm";
import DeleteCharacter from "@/app/components/characters/DeleteCharacter";

export const metadata: Metadata = { title: "Editar personaje" };

export default async function EditCharacterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/characters/${id}/edit`);
  // Solo el dueño puede editar: para el resto (y si no existe) es un 404
  const found = await loadCharacterFor(user.id, id, "write");
  if (!found) notFound();
  const { character: c, sheet, entries } = found;
  // Identificador de la especie para el generador de nombres ("species:dwarf|xphb" → "dwarf" si ya no está)
  const speciesIdentifier = entries.get(refKey(sheet.species.ref))?.identifier
    || bareName(sheet.species.ref.key);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link href={`/characters/${id}`} className="mb-4 flex w-max items-center gap-1 text-sm text-muted hover:text-white">
        <ChevronLeft size={16} aria-hidden="true" /> Volver a la ficha
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-3xl font-extrabold">Editar personaje</h1>
        <div className="flex flex-wrap items-center gap-2">
          {/* Solo a nivel 1: después, los niveles se borran uno a uno */}
          {!found.outdated && sheet.levels.length === 1 && (
            <Link
              href={`/characters/${id}/recreate`}
              className="flex w-max items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs font-bold transition-colors hover:border-brand"
            >
              <RotateCcw size={14} aria-hidden="true" /> Rehacer creación
            </Link>
          )}
          <DeleteCharacter characterId={id} characterName={c.name} />
        </div>
      </div>

      <CharacterEditForm
        characterId={id}
        speciesIdentifier={speciesIdentifier}
        initial={{
          name: c.name,
          pronouns: parsePronouns(((c.pronouns ?? []) as string[]).join(",")) ?? [],
          status: c.status,
          alignment: sheet.alignment,
          age: sheet.age,
          xp: String(sheet.xp),
          appearance: sheet.appearance,
          backstory: c.backstory ?? "",
          languages: sheet.languages,
          notes: sheet.notes,
          portraitUrl: c.portraitId ? `/api/images/${c.portraitId}` : null,
          imageUrl: c.imageId ? `/api/images/${c.imageId}` : null,
        }}
      />
    </div>
  );
}
