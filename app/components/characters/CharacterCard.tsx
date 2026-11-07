import Link from "next/link";
import { avatarTone, initialsOf } from "@/lib/utils/initials";
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

const STATUS = {
  retired: { label: "Retirado", tone: "bg-[#3a3a3e] text-[#d6d6da]" },
  dead: { label: "Fallecido", tone: "bg-[#4a1418] text-[#f7bcc0]" },
  npc: { label: "PNJ", tone: "bg-[#17324f] text-[#b0d4f8]" },
} as const;

const badge = "rounded-full px-2.5 py-0.5 text-xs font-semibold";

export default function CharacterCard({ character: c }: { character: CharacterCardData }) {
  const dead = c.status === "dead";
  return (
    /* El título lleva un enlace "estirado" (after:inset-0) que hace pulsable toda la tarjeta; el enlace a la campaña y
       el menú quedan por encima (la fila de etiquetas deja pasar los clics salvo en ese enlace). Con el menú abierto, la tarjeta sube para que no lo tapen las siguientes. */
    <article className="group relative flex min-h-32 rounded-lg border border-line bg-panel transition-colors hover:border-line-strong has-[a:focus-visible]:border-brand-soft has-[[data-menu-open]]:z-30">
      <div className="w-24 shrink-0 overflow-hidden rounded-l-[calc(var(--radius-lg)-1px)] sm:w-28">
        {c.portraitUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.portraitUrl}
            alt=""
            loading="lazy"
            className={`h-full w-full object-cover ${dead ? "grayscale" : ""}`}
          />
        ) : (
          <div
            aria-hidden="true"
            className={`flex h-full w-full items-center justify-center font-display text-3xl ${dead ? "bg-[#2c2c2f] text-[#b4b4ba]" : avatarTone(c.name)}`}
          >
            {initialsOf(c.name)}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-4">
        <h2 className="line-clamp-2 pr-7 font-heading text-xl font-bold leading-tight wrap-anywhere">
          <Link
            href={`/characters/${c.id}`}
            className="outline-none after:absolute after:inset-0 after:rounded-lg after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-brand-soft"
          >
            {c.name}
          </Link>
        </h2>
        {c.summary && <p className="mt-1 line-clamp-2 text-sm leading-snug text-muted">{c.summary}</p>}
        <p className="mt-1 text-xs text-muted">{c.systemName}</p>

        <div className="pointer-events-none relative z-10 mt-auto flex flex-wrap items-center gap-1.5 pt-3">
          {c.status !== "active" && <span className={`${badge} ${STATUS[c.status].tone}`}>{STATUS[c.status].label}</span>}
          {c.campaign ? (
            <Link
              href={`/campaigns/${c.campaign.id}`}
              className={`${badge} pointer-events-auto max-w-full truncate border border-line-strong bg-surface text-fg transition-colors hover:border-fg`}
            >
              {c.campaign.name}
            </Link>
          ) : (
            <span className={`${badge} border border-line text-muted`}>Sin campaña</span>
          )}
          {c.campaign && c.pending && (
            <span className={`${badge} bg-[#47380f] text-[#f3d98b]`}>Pendiente</span>
          )}
        </div>
      </div>

      <CharacterCardMenu characterId={c.id} characterName={c.name} />
    </article>
  );
}
