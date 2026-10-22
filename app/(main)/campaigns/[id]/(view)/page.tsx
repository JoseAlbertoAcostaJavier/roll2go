import { BookOpen, UserRound } from "lucide-react";
import Bbcode from "@/app/components/Bbcode";
import ConfirmAction from "@/app/components/ConfirmAction";
import UserLink from "@/app/components/UserLink";
import { getCampaignAccess } from "@/lib/campaignAccess";
import { Campaign } from "@/lib/Campaign";
import { books } from "@/lib/books";
import { loadUserCards } from "@/lib/userCards";

const heading = "mb-3 border-l-4 border-brand pl-3 font-heading text-xl font-bold";

export default async function CampaignDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, campaign, isDm } = await getCampaignAccess(id);

  // Las notas privadas solo se cargan de la base de datos si eres el DM
  const notes = isDm
    ? ((await Campaign.findById(id).select("+privateNotes").lean())?.privateNotes as string | undefined)
    : undefined;

  // Participantes: el DM primero
  const ownerId = String(campaign.owner);
  const cards = await loadUserCards(campaign.members);
  const people = [...cards.values()].sort(
    (a, b) => Number(b.id === ownerId) - Number(a.id === ownerId) || a.displayName.localeCompare(b.displayName, "es"),
  );
  const bookNames = campaign.restrictBooks
    ? (campaign.allowedBooks as string[]).map((b) => books.find((x) => x.id === b)?.name ?? b)
    : null;
  const ch = campaign.characters;
  const characterText = !ch?.allowed
    ? "No se pueden añadir personajes."
    : [ch.internal && "internos (creados desde la campaña)", ch.external && "externos (creados fuera)"]
        .filter(Boolean)
        .join(" y ");

  return (
    <div className="animate-fade-in space-y-8">
      {campaign.imageId && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/images/${campaign.imageId}`} alt="" className="h-56 w-full rounded-lg object-cover shadow-[0_10px_30px_rgba(0,0,0,0.4)] sm:h-72" />
      )}

      {campaign.shortDescription && <p className="text-lg text-muted">{campaign.shortDescription}</p>}

      {campaign.description && (
        <section>
          <h2 className={heading}>Descripción</h2>
          <Bbcode source={campaign.description} />
        </section>
      )}

      <section>
        <h2 className={heading}>Participantes</h2>
        <ul className="flex flex-wrap gap-2">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-sm transition-colors hover:border-muted">
              <UserLink user={p} size={28} crown={p.id === ownerId} />
              {p.id === ownerId && <span className="text-xs text-brand-soft">DM</span>}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className={heading}>Reglas de la campaña</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex gap-3 rounded-lg border border-line bg-surface p-4">
            <BookOpen size={20} className="mt-0.5 shrink-0 text-brand-soft" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-semibold">Libros</p>
              <p className="text-muted">
                {bookNames === null
                  ? "Se pueden usar todos los libros."
                  : bookNames.length > 0
                    ? `Solo: ${bookNames.join(", ")}.`
                    : "No se ha permitido ningún libro."}
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-lg border border-line bg-surface p-4">
            <UserRound size={20} className="mt-0.5 shrink-0 text-brand-soft" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-semibold">Personajes</p>
              <p className="text-muted">
                {ch?.allowed ? `Se admiten personajes ${characterText || "de ningún tipo"}.` : characterText}
              </p>
            </div>
          </div>
        </div>
      </section>

      {isDm && (
        <section className="rounded-lg border border-brand/40 bg-brand/10 p-5">
          <h2 className="mb-3 font-heading text-lg font-bold">Notas privadas (solo tú)</h2>
          {notes ? (
            <p className="whitespace-pre-wrap break-words text-sm">{notes}</p>
          ) : (
            <p className="text-sm text-muted">No has escrito notas.</p>
          )}
        </section>
      )}

      {/* El DM no puede abandonar su campaña (tendría que borrarla) */}
      {!isDm && (
        <div className="flex justify-end border-t border-line pt-4">
          <ConfirmAction
            url={`/api/campaigns/${id}/members/${session.id}`}
            label="Abandonar campaña"
            question="¿Seguro que quieres abandonar la campaña?"
            confirmLabel="Sí, abandonar"
            redirectTo="/campaigns"
          />
        </div>
      )}
    </div>
  );
}