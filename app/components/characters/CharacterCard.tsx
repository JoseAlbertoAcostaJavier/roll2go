import Link from "next/link";
import { User as UserIcon } from "lucide-react";

export type CharacterCardData = {
  id: string;
  name: string;
  portraitUrl: string | null;
  summary: string; // "Especie (Legado) · Clase N"
  systemName: string;
  status: "active" | "retired" | "dead";
  campaign: { id: string; name: string } | null;
};

const STATUS_LABEL = { retired: "Retirado", dead: "Fallecido" } as const;

export default function CharacterCard({ character: c, index }: { character: CharacterCardData; index: number }) {
  return (
    /* El título lleva un enlace "estirado" (after:inset-0); el enlace a la campaña queda por encima (z-10). */
    <article
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
      className="group relative flex animate-fade-up gap-4 rounded-lg border border-line bg-panel p-4 transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-brand hover:shadow-[0_10px_30px_rgba(0,0,0,0.45)] has-[a:focus-visible]:border-brand"
    >
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface text-muted">
        {c.portraitUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.portraitUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <UserIcon size={32} aria-hidden="true" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <h2 className="truncate font-heading text-lg font-bold">
          {/* La hoja del personaje llega en una tarea posterior */}
          <Link href={`/characters/${c.id}`} className="outline-none after:absolute after:inset-0 after:content-['']">
            {c.name}
          </Link>
        </h2>
        {c.summary && <p className="truncate text-sm text-muted">{c.summary}</p>}
        <p className="mt-2 text-sm font-semibold">{c.systemName}</p>
        <div className="relative z-10 mt-auto flex flex-wrap items-center gap-x-3 pt-2 text-sm">
          {c.campaign ? (
            <Link href={`/campaigns/${c.campaign.id}`} className="truncate text-brand-soft hover:underline">
              {c.campaign.name}
            </Link>
          ) : (
            <span className="text-muted">Sin campaña</span>
          )}
          {c.status !== "active" && (
            <span className="rounded bg-black/70 px-2 py-0.5 text-xs font-semibold text-muted">
              {STATUS_LABEL[c.status]}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
