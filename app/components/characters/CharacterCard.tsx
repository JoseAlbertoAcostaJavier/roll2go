import Link from "next/link";
import { initialsOf } from "@/lib/utils/initials";
import CharacterCardMenu from "./CharacterCardMenu";

export type CharacterCardData = {
  id: string;
  name: string;
  portraitUrl: string | null;
  summary: string; // "Especie (Legado) · Clase N"
  systemName: string;
  status: "active" | "retired" | "dead" | "npc";
  campaign: { id: string; name: string } | null;
  /** La solicitud para unirse a `campaign` espera a que el DM la acepte. */
  pending: boolean;
};

const STATUS_LABEL = { retired: "Retirado", dead: "Fallecido", npc: "PNJ" } as const;

const STATUS_COLORS = {
  retired: "bg-gray-500/10 text-gray-300 border border-gray-500/20",
  dead: "bg-red-500/10 text-red-300 border border-red-500/20",
  npc: "bg-blue-500/10 text-blue-300 border border-blue-500/20",
} as const;

const badge = "rounded-md px-2 py-0.5 text-[11px] font-bold";

export default function CharacterCard({ character: c, index }: { character: CharacterCardData; index: number }) {
  return (
    /* El título lleva un enlace "estirado" (after:inset-0) que hace pulsable toda la tarjeta; el enlace a la campaña y
       el menú quedan por encima (la fila de etiquetas deja pasar los clics salvo en ese enlace). Con el menú abierto,
       la tarjeta sube para que no lo tapen las siguientes. */
    <article
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
      className="group relative flex animate-fade-up gap-4 rounded-xl border border-line bg-panel p-4 transition-all duration-200 hover:-translate-y-1 hover:border-brand-soft hover:shadow-lg hover:shadow-brand/5 has-[a:focus-visible]:border-brand has-[[data-menu-open]]:z-30"
    >
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface text-xl font-bold text-muted transition-colors group-hover:bg-line/50 group-hover:text-white">
        {c.portraitUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.portraitUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <span aria-hidden="true">{initialsOf(c.name)}</span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <h2 className="line-clamp-2 pr-7 font-heading text-xl font-extrabold leading-tight text-white wrap-anywhere">
          <Link
            href={`/characters/${c.id}`}
            className="outline-none after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-brand-soft"
          >
            {c.name}
          </Link>
        </h2>

        {c.summary && <p title={c.summary} className="mt-0.5 truncate text-sm font-medium text-muted">{c.summary}</p>}
        <p className="mt-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">{c.systemName}</p>

        <div className="pointer-events-none relative z-10 mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-3 text-sm">
          {c.campaign ? (
            <Link
              href={`/campaigns/${c.campaign.id}`}
              className="pointer-events-auto truncate font-semibold text-brand-soft transition-colors hover:text-brand hover:underline"
            >
              {c.campaign.name}
            </Link>
          ) : (
            <span className={`${badge} border border-dashed border-line font-medium text-muted`}>Sin campaña</span>
          )}
          {c.campaign && c.pending && <span className={`${badge} bg-yellow-500/10 text-yellow-400`}>Pendiente</span>}
          {c.status !== "active" && <span className={`${badge} ${STATUS_COLORS[c.status]}`}>{STATUS_LABEL[c.status]}</span>}
        </div>
      </div>

      <CharacterCardMenu characterId={c.id} characterName={c.name} />
    </article>
  );
}
