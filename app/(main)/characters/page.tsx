import type { Metadata } from "next";
import Link from "next/link";
import { Files, SearchX } from "lucide-react";
import { requireUser } from "@/lib/server/auth/currentUser";
import { listMyCharacters } from "@/lib/server/characters/queries";
import { system as rpgSystems } from "@/lib/utils/systems";
import { first } from "@/lib/utils/utils";
import CharacterCard, { type CharacterCardData } from "@/app/components/characters/CharacterCard";
import NewCharacterDialog from "@/app/components/characters/creator/NewCharacterDialog";
import ListFilters from "@/app/components/ui/ListFilters";

export const metadata: Metadata = { title: "Mis personajes" };

const STATUSES = ["active", "retired", "dead", "npc", "all"] as const;
const SORTS = ["recent", "name"] as const;
const STATUS_TABS: { value: (typeof STATUSES)[number]; label: string }[] = [
  { value: "active", label: "Activos" },
  { value: "retired", label: "Retirados" },
  { value: "dead", label: "Fallecidos" },
  { value: "npc", label: "PNJ" },
  { value: "all", label: "Todos" },
];
// Lo que devuelve como máximo la lista (listMyCharacters)
const LIST_LIMIT = 100;

// Devuelve el valor solo si es uno de los permitidos; si no, el valor por defecto
function pick<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.find((a) => a === value) ?? fallback;
}

export default async function CharactersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = (first(sp.q) ?? "").trim().slice(0, 80);
  const status = pick(first(sp.status), STATUSES, "active");
  const sort = pick(first(sp.sort), SORTS, "recent");

  const user = await requireUser("/characters");
  // Tarjetas con los filtros, campañas en las que se puede crear un personaje y libros del usuario
  const data = await listMyCharacters(user.id, { q, status, sort });
  const cards: CharacterCardData[] = data.cards;
  const { counts, dialogCampaigns, books } = data;

  const systems = rpgSystems.map((s) => ({ id: s.id, name: s.name, creator: s.creator }));

  return (
    <div className="mx-auto max-w-300 px-5 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-3xl font-extrabold text-white">Mis personajes</h1>
        <NewCharacterDialog systems={systems} campaigns={dialogCampaigns} books={books} />
      </div>

      <ListFilters
        className="mb-6 rounded-xl border border-line bg-surface/50 p-4 shadow-sm"
        base="/characters"
        q={q}
        searchLabel="Buscar personajes"
        placeholder="Nombre, especie, clase o campaña"
        selects={[
          {
            name: "status", label: "Estado", value: status, defaultValue: "active", tabs: true,
            options: STATUS_TABS.map((t) => ({ ...t, count: counts[t.value] })),
          },
          {
            name: "sort", label: "Ordenar por", value: sort, defaultValue: "recent",
            options: [
              { value: "recent", label: "Recientes primero" },
              { value: "name", label: "Ordenar por nombre" },
            ],
          },
        ]}
      />

      {/* Se anuncia al cambiar los filtros; a la vista solo al buscar */}
      <p role="status" className={q ? "mb-4 text-sm text-muted" : "sr-only"}>
        {cards.length} {cards.length === 1 ? "personaje" : "personajes"}{q ? <> para «<span className="text-fg">{q}</span>»</> : null}
      </p>

      {cards.length === 0 ? (
        counts.all > 0 || q ? (
          <div className="rounded-xl border border-dashed border-line p-12 text-center text-muted">
            <SearchX size={40} className="mx-auto mb-4 text-line" aria-hidden="true" />
            <p className="font-medium">
              {q ? "No se han encontrado personajes con esos filtros." : `No tienes personajes en «${STATUS_TABS.find((t) => t.value === status)?.label}».`}
            </p>
            <Link href={q ? "/characters" : "/characters?status=all"} className="mt-3 inline-block text-sm font-semibold text-brand-soft hover:underline">
              {q ? "Limpiar filtros" : "Ver todos tus personajes"}
            </Link>
          </div>
        ) : (
          <div className="animate-fade-up rounded-xl border border-dashed border-line bg-surface/30 p-12 text-center shadow-sm">
            <Files size={56} className="mx-auto mb-6 text-line" aria-hidden="true" />
            <h2 className="mb-3 font-heading text-2xl font-bold text-white">Aún no tienes ningún personaje</h2>
            <p className="mx-auto mb-8 max-w-lg text-sm text-muted">
              Crea y gestiona los personajes para tus partidas. Podrás imprimirlos en papel, llevarlos en tu móvil a la mesa o jugar con ellos en partidas online.
            </p>
            <div className="flex justify-center">
              <NewCharacterDialog systems={systems} campaigns={dialogCampaigns} books={books} />
            </div>
          </div>
        )
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-5">
          {cards.map((c, i) => (
            <CharacterCard key={c.id} character={c} index={i} />
          ))}
        </div>
      )}

      {cards.length === LIST_LIMIT && counts[status] > LIST_LIMIT && (
        <p className="mt-6 text-center text-sm text-muted">
          Se muestran {LIST_LIMIT} de {counts[status]}. Busca por nombre para encontrar el resto.
        </p>
      )}
    </div>
  );
}
