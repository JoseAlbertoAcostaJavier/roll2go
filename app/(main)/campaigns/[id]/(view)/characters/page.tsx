import Link from "next/link";
import { getCampaignAccess } from "@/lib/campaignAccess";
import { Character } from "@/lib/Character";
import UserLink from "@/app/components/UserLink";
import { loadUserCards } from "@/lib/userCards";

export default async function CampaignCharactersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { campaign } = await getCampaignAccess(id);

  const characters = await Character.find({ campaign: campaign._id })
    .select("name owner origin sheet.species.name sheet.classes.name sheet.classes.level")
    .sort({ createdAt: 1 })
    .lean();

  const ownerCards = await loadUserCards(characters.map((c) => c.owner));

  return (
    <section>
      <h2 className="mb-2 font-heading text-lg font-bold uppercase tracking-wide">Personajes</h2>
      <p className="mb-5 text-sm text-muted">Los personajes de los participantes de esta campaña.</p>

      {characters.length === 0 ? (
        <div className="rounded-md bg-surface p-4 text-sm text-muted">No se han encontrado personajes.</div>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(240px,100%),1fr))] gap-3">
          {characters.map((c) => (
            <li key={String(c._id)} className="rounded-lg border border-line bg-surface p-4">
              <p className="font-heading font-bold">
                <Link href={`/characters/${c._id}`} className="hover:text-brand-soft hover:underline">{c.name}</Link>
              </p>
              {(() => {
                // "Especie · Clase N"
                const s = c.sheet ?? {};
                const cls = s.classes?.[0];
                const text = [s.species?.name, cls?.name ? `${cls.name}${cls.level ? ` ${cls.level}` : ""}` : ""]
                  .filter(Boolean)
                  .join(" · ");
                return text ? <p className="text-sm text-muted">{text}</p> : null;
              })()}
              {(() => {
                const owner = ownerCards.get(String(c.owner));
                return owner ? <UserLink user={owner} size={24} className="mt-1 text-sm" /> : <p className="text-sm text-muted">Desconocido</p>;
              })()}
              {c.origin && (
                <span className="mt-2 inline-block rounded bg-panel px-2 py-0.5 text-xs text-muted">
                  {c.origin === "internal" ? "Interno" : "Externo"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}