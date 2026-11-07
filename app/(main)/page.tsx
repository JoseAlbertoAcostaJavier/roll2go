import Link from "next/link";
import type { Metadata } from "next";
import DiceRoller from "@/app/components/ui/DiceRoller";
import SystemsGrid from "@/app/components/layout/SystemsGrid";
import CharacterCard from "@/app/components/characters/CharacterCard";
import CampaignCard from "@/app/components/campaigns/CampaignCard";
import { cardTitle, primaryButton, secondaryButton } from "@/app/components/ui/formStyles";
import { getCurrentUser } from "@/lib/server/auth/currentUser";
import { listMyCharacters } from "@/lib/server/characters/queries";
import { campaignCardOf, listMyCampaigns } from "@/lib/server/campaigns/queries";

export const metadata: Metadata = { title: "Inicio" };

const seeAll = "text-sm font-semibold text-brand-soft hover:underline";

export default async function Page() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-280 px-5">
        <section className="grid items-center gap-10 py-9 md:grid-cols-[1.1fr_1fr] md:py-14">
          <div>
            <h1 className="mb-4 font-heading text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold leading-[1.1]">
              ¿Cansado del papel y boli?
            </h1>
            <p className="max-w-[46ch] text-muted">
              Crea personajes, organiza campañas y tira dados con tu grupo desde el móvil o el ordenador en Roll2Go.
            </p>
          </div>
          <DiceRoller />
        </section>
        <SystemsGrid />
      </div>
    );
  }

  // Los más recientes, con los mismos criterios que los listados (activos, recientes primero)
  const [characters, campaigns] = await Promise.all([
    listMyCharacters(user.id, { q: "", status: "active", sort: "recent", limit: 3 }),
    listMyCampaigns(user.id, { q: "", owner: "all", status: "active", sort: "recent", limit: 2 }),
  ]);
  const cards = characters.cards;
  const empty = cards.length === 0 && campaigns.campaigns.length === 0;

  return (
    <div className="mx-auto max-w-280 px-5">
      <section className="py-9 md:pb-6 md:pt-14">
        <h1 className="mb-8 wrap-anywhere font-heading text-[clamp(2rem,4.5vw,3.2rem)] font-extrabold leading-[1.1]">
          Hola, {user.displayName}
        </h1>

        <h2 className={cardTitle}>Continuar</h2>
        {empty ? (
          <div className="rounded-lg border border-dashed border-line p-8 text-center">
            <p className="mb-5 text-muted">No tienes personajes ni campañas activos.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/characters/new?system=dnd-2024" className={primaryButton}>
                Crear personaje
              </Link>
              <Link href="/campaigns/new" className={secondaryButton}>
                Crear campaña
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {cards.length > 0 && (
              <div>
                <div className="mb-3 flex items-center justify-between gap-4">
                  <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-muted">Personajes</h3>
                  <Link href="/characters" className={seeAll}>
                    Ver todos
                  </Link>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-4">
                  {cards.map((c, i) => (
                    <CharacterCard key={c.id} character={c} index={i} />
                  ))}
                </div>
              </div>
            )}
            {campaigns.campaigns.length > 0 && (
              <div>
                <div className="mb-3 flex items-center justify-between gap-4">
                  <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-muted">Campañas</h3>
                  <Link href="/campaigns" className={seeAll}>
                    Ver todas
                  </Link>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-4">
                  {campaigns.campaigns.map((c, i) => {
                    const owner = campaigns.ownerCards.get(String(c.owner));
                    return (
                      <CampaignCard
                        key={String(c._id)}
                        index={i}
                        userId={user.id}
                        owner={owner ? { username: owner.username, displayName: owner.displayName, avatarUrl: owner.avatarUrl } : null}
                        campaign={campaignCardOf(c, user.id)}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="max-w-xl pb-10">
        <DiceRoller />
      </section>
      <SystemsGrid />
    </div>
  );
}
