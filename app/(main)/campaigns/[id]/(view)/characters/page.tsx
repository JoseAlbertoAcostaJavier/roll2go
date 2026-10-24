import Link from "next/link";
import mongoose from "mongoose";
import { Plus } from "lucide-react";
import { getCampaignAccess } from "@/lib/campaignAccess";
import { Book } from "@/lib/Book";
import { Character } from "@/lib/Character";
import { canRequestJoin } from "@/lib/CampaignRules";
import { loadUserCards } from "@/lib/userCards";
import { system as rpgSystems } from "@/lib/systems";
import { booksUsedBy } from "@/lib/rules/dnd2024/booksUsed";
import type { AnySheet, Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet";
import { classesOf } from "@/lib/rules/dnd2024/upgrade";
import CampaignCharacterCard, { type CampaignCharacterData } from "@/app/components/campaigns/CampaignCharacterCard";
import AddCharacterDialog, { type AddableCharacter } from "@/app/components/campaigns/AddCharacterDialog";
import { CharacterNoticeArea, CharacterNotices } from "@/app/components/campaigns/CharacterActions";

// «Especie Clase N»; con multiclase, «Especie Clase N / Clase M»
function summaryOf(sheet: Parameters<typeof classesOf>[0] & { species?: { name?: string } }) {
  const classes = classesOf(sheet)
    .filter((c) => c.class?.name)
    .map((c) => `${c.class.name}${c.level ? ` ${c.level}` : ""}`)
    .join(" / ");
  return [sheet.species?.name, classes].filter(Boolean).join(" ");
}

// Libros que usa una hoja; una v1 (aún sin migrar) guarda sus clases en `classes` en vez de en `levels`
function usedBooks(sheet: AnySheet | undefined) {
  if (sheet?.version === 2) return booksUsedBy(sheet);
  if (sheet?.version === 1) return booksUsedBy({ ...sheet, levels: sheet.classes } as unknown as Dnd2024SheetV2);
  return [];
}

export default async function CampaignCharactersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, campaign, isDm } = await getCampaignAccess(id);
  // Mismo criterio que el creador y la ruta de solicitud
  const rules = {
    allowed: campaign.characters?.allowed === true,
    internal: campaign.characters?.internal === true,
    external: campaign.characters?.external === true,
  };
  const system = rpgSystems.find((s) => s.id === campaign.systemId);
  const systemName = system?.name ?? campaign.systemId;

  // El DM ve también las solicitudes pendientes; el resto, los aprobados y sus propias solicitudes
  const visible = isDm ? {} : { $or: [{ campaignStatus: { $ne: "pending" } }, { owner: session.id }] };
  const found = await Character.find({ campaign: campaign._id, ...visible })
    .select("name owner status portraitId campaignStatus sheet.species.name sheet.classes.name sheet.classes.level sheet.classesSummary")
    .sort({ createdAt: 1 })
    .lean();
  // Pendientes primero (sort es estable: dentro de cada grupo se mantiene el orden de creación)
  found.sort((a, b) => Number(b.campaignStatus === "pending") - Number(a.campaignStatus === "pending"));

  const ownerCards = await loadUserCards(found.map((c) => c.owner));
  const characters: CampaignCharacterData[] = found.map((c) => {
    const owner = ownerCards.get(String(c.owner));
    return {
      id: String(c._id),
      name: c.name,
      portraitUrl: c.portraitId ? `/api/images/${c.portraitId}` : null,
      summary: summaryOf(c.sheet ?? {}),
      status: c.status ?? "active",
      pending: c.campaignStatus === "pending",
      owner: owner ? { username: owner.username, displayName: owner.displayName } : null,
      isOwn: String(c.owner) === session.id,
    };
  });

  // Personajes propios que se pueden añadir: del mismo sistema y sin campaña, cada uno con su elegibilidad
  let addable: AddableCharacter[] = [];
  const canAdd = rules.allowed && rules.external;
  if (canAdd) {
    const mine = await Character.find({ owner: session.id, systemId: campaign.systemId, campaign: { $exists: false } })
      .select("name systemId sheet")
      .sort({ name: 1 })
      .collation({ locale: "es", strength: 2 })
      .lean();
    const checks = mine.map((c) =>
      canRequestJoin({
        campaign: {
          systemId: campaign.systemId,
          status: campaign.status,
          characters: rules,
          restrictBooks: !!campaign.restrictBooks,
          allowedBooks: campaign.allowedBooks ?? [],
        },
        character: { systemId: c.systemId, campaign: null, books: usedBooks(c.sheet) },
        isMember: true,
      }),
    );
    // Nombres de los libros no permitidos, para el motivo (si alguno ya no existe, se muestra su id)
    const disallowed = [...new Set(checks.flatMap((r) => (r.ok ? [] : (r.disallowed ?? []))))];
    const books = disallowed.length
      ? await Book.find({ _id: { $in: disallowed.filter((b) => mongoose.isValidObjectId(b)) } }).select("name").lean()
      : [];
    const bookNames = new Map(books.map((b: { _id: unknown; name: string }) => [String(b._id), b.name]));
    addable = mine.map((c, i) => {
      const r = checks[i];
      let reason: string | null = null;
      if (!r.ok) {
        reason = r.disallowed?.length
          ? `Este personaje usa libros que la campaña no permite: ${r.disallowed.map((b) => bookNames.get(b) ?? b).join(", ")}.`
          : r.error;
      }
      return { id: String(c._id), name: c.name, summary: summaryOf(c.sheet ?? {}), reason };
    });
  }

  const help = !rules.allowed
    ? "Esta campaña no admite personajes."
    : rules.internal && rules.external
      ? "Crea un personaje para esta campaña o añade uno que ya tengas."
      : rules.internal
        ? "Crea tu personaje desde aquí: la campaña no admite personajes creados fuera de ella."
        : "Añade un personaje que ya tengas: la campaña no admite crearlos desde aquí.";
  const reviewed = rules.allowed && rules.external && !isDm ? " El DM tiene que aceptar los que se añaden." : "";

  return (
    <CharacterNotices>
      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide">Personajes</h2>
          <div className="flex flex-wrap gap-2">
            {canAdd && (
              <AddCharacterDialog campaignId={id} characters={addable} isDm={isDm} systemName={systemName} />
            )}
            {rules.allowed && rules.internal && system?.creator && (
              <Link
                href={`/characters/new?${new URLSearchParams({ system: campaign.systemId, campaign: id })}`}
                className="flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-hover"
              >
                <Plus size={14} aria-hidden="true" /> Crear personaje
              </Link>
            )}
          </div>
        </div>
        <p className="mb-5 text-sm text-muted">{help}{reviewed}</p>

        <CharacterNoticeArea />
        {characters.length === 0 ? (
          <div className="rounded-md bg-surface p-4 text-sm text-muted">Aún no hay personajes en esta campaña.</div>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-3">
            {characters.map((c) => (
              <CampaignCharacterCard key={c.id} character={c} campaignId={id} isDm={isDm} />
            ))}
          </ul>
        )}
      </section>
    </CharacterNotices>
  );
}
