import type { Metadata } from "next";
import Link from "next/link";
import { Files } from "lucide-react";
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
  const hasFilters = q !== "" || status !== "active" || sort !== "recent";

  const user = await requireUser("/characters");
  // Tarjetas con los filtros, campañas en las que se puede crear un personaje y libros del usuario
  const data = await listMyCharacters(user.id, { q, status, sort });
  const cards: CharacterCardData[] = data.cards;
  const { dialogCampaigns, books } = data;

  const systems = rpgSystems.map((s) => ({ id: s.id, name: s.name, creator: s.creator }));

  return (
    <div className="mx-auto max-w-280 px-5 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-3xl font-extrabold">Mis personajes</h1>
        <NewCharacterDialog systems={systems} campaigns={dialogCampaigns} books={books} />
      </div>

      <ListFilters
        className="mb-6"
        base="/characters"
        title="Buscar personajes"
        q={q}
        searchLabel="Buscar personajes"
        placeholder="Nombre, especie, clase o campaña"
        selects={[
          {
            name: "status", label: "Estado", value: status, defaultValue: "active",
            options: [
              { value: "active", label: "Activos" },
              { value: "retired", label: "Retirados" },
              { value: "dead", label: "Fallecidos" },
              { value: "npc", label: "PNJ" },
              { value: "all", label: "Todos" },
            ],
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

      {cards.length === 0 ? (
        hasFilters ? (
          <div className="rounded-lg border border-dashed border-line p-10 text-center">
            <p className="mb-3 text-muted">Ningún personaje coincide con esos filtros.</p>
            <Link href="/characters" className="font-semibold text-brand-soft hover:underline">Quitar filtros</Link>
          </div>
        ) : (
          <div className="flex flex-col items-center rounded-lg border border-dashed border-line p-10 text-center">
            <Files size={48} className="mb-4 text-muted" aria-hidden="true" />
            <h2 className="mb-2 font-heading text-xl font-bold">Aún no tienes ningún personaje</h2>
            <p className="mb-6 max-w-xl text-muted">
              Crea tus personajes para imprimirlos en papel, llevarlos a la partida en el móvil o la tablet, o jugar con ellos online.
            </p>
            <NewCharacterDialog systems={systems} campaigns={dialogCampaigns} books={books} />
          </div>
        )
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-4">
          {cards.map((c) => (
            <CharacterCard key={c.id} character={c} />
          ))}
        </div>
      )}
    </div>
  );
}
