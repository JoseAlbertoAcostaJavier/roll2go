import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUp, Files } from "lucide-react";
import { requireUser } from "@/lib/server/auth/currentUser";
import { listMyCharacters } from "@/lib/server/characters/queries";
import { system as rpgSystems } from "@/lib/utils/systems";
import { first } from "@/lib/utils/utils";
import CharacterCard, { type CharacterCardData } from "@/app/components/characters/CharacterCard";
import NewCharacterDialog from "@/app/components/characters/creator/NewCharacterDialog";
import { secondaryButton } from "@/app/components/ui/formStyles";

export const metadata: Metadata = { title: "Mis personajes" };

const STATUSES = ["active", "retired", "dead", "npc", "all"] as const;
const SORTS = ["recent", "name"] as const;

// Devuelve el valor solo si es uno de los permitidos; si no, el valor por defecto
function pick<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.find((a) => a === value) ?? fallback;
}

const field =
  "h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-fg placeholder:text-muted focus:border-brand focus:outline-none";

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

      {/* Buscador: formulario GET, los filtros quedan en la dirección */}
      <form
        key={`${q}|${status}|${sort}`}
        action="/characters"
        method="get"
        className="mb-6 rounded-lg border border-line bg-panel p-5"
      >
        <h2 className="mb-4 font-heading text-sm font-bold uppercase tracking-wide text-muted">Buscar personajes</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]">
          <input
            type="search"
            name="q"
            defaultValue={q}
            maxLength={80}
            placeholder="Nombre, especie, clase o campaña"
            aria-label="Buscar personajes"
            className={field}
          />
          <select name="status" defaultValue={status} aria-label="Estado" className={field}>
            <option value="active">Activos</option>
            <option value="retired">Retirados</option>
            <option value="dead">Fallecidos</option>
            <option value="npc">PNJ</option>
            <option value="all">Todos</option>
          </select>
          <select name="sort" defaultValue={sort} aria-label="Ordenar por" className={field}>
            <option value="recent">Recientes primero</option>
            <option value="name">Ordenar por nombre</option>
          </select>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className={`${secondaryButton} h-11 flex-1`}
            >
              Buscar
            </button>
            {hasFilters && (
              <Link href="/characters" className="text-sm text-muted hover:text-white">
                Limpiar
              </Link>
            )}
          </div>
        </div>
      </form>

      {cards.length === 0 ? (
        hasFilters ? (
          <div className="rounded-lg border border-dashed border-line p-10 text-center text-muted">
            <p>No se han encontrado personajes con esos filtros.</p>
          </div>
        ) : (
          <div className="animate-fade-up rounded-lg border border-dashed border-line p-10 text-center">
            <p className="mb-4 flex items-center justify-center gap-2 font-heading font-bold text-brand-soft sm:justify-end">
              <ArrowUp size={18} aria-hidden="true" /> ¡Crea el primero!
            </p>
            <Files size={48} className="mx-auto mb-4 text-muted" aria-hidden="true" />
            <h2 className="mb-2 font-heading text-xl font-bold">Aún no tienes ningún personaje</h2>
            <p className="mx-auto max-w-xl text-muted">
              Puedes crear y gestionar los personajes para tus partidas, para luego imprimirlos en papel, llevarlos en
              tu móvil o tablet a la partida o jugar con ellos en partidas online
            </p>
          </div>
        )
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-4">
          {cards.map((c, i) => (
            <CharacterCard key={c.id} character={c} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
