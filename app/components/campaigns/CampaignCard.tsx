import Link from "next/link";
import Avatar from "@/app/components/ui/Avatar";
import ConfirmAction from "@/app/components/ui/ConfirmAction";

export type CampaignCardData = {
  id: string;
  name: string;
  systemName: string;
  status: string;
  imageId: string | null;
  logoId: string | null;
  shortDescription: string;
  players: number; // sin contar al DM
  mine: boolean; // el usuario es el DM
};

type Owner = { username: string; displayName: string; avatarUrl: string | null };

export default function CampaignCard({
  campaign: c,
  owner,
  userId,
  index,
}: {
  campaign: CampaignCardData;
  owner: Owner | null;
  userId: string;
  index: number;
}) {
  return (
    /* La tarjeta entera abre la campaña gracias al enlace "estirado" del título (after:inset-0).
       El pie queda por encima (z-10) para que el enlace al DM y el botón de abandonar funcionen. */
    <article
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
      className="group relative flex animate-fade-up flex-col overflow-hidden rounded-lg border border-line bg-panel transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-brand hover:shadow-[0_10px_30px_rgba(0,0,0,0.45)] has-[a:focus-visible]:border-brand"
    >
      <div className="relative h-36 overflow-hidden bg-surface">
        {c.imageId && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/images/${c.imageId}`} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        )}
        {c.logoId && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/images/${c.logoId}`} alt="" loading="lazy" className="absolute bottom-2 left-2 h-12 w-12 rounded-md bg-surface object-cover shadow-md" />
        )}
        {c.status === "inactive" && (
          <span className="absolute right-2 top-2 rounded bg-black/70 px-2 py-0.5 text-xs font-semibold text-muted">
            Inactiva
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h2 className="font-heading text-lg font-bold">
          <Link href={`/campaigns/${c.id}`} className="outline-none after:absolute after:inset-0 after:rounded-lg after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-brand-soft">
            {c.name}
          </Link>
        </h2>
        {c.shortDescription && <p className="mt-1 line-clamp-3 text-sm text-muted">{c.shortDescription}</p>}
        <p className="mt-3 text-sm font-semibold">{c.systemName}</p>
        <p className="text-sm text-muted">
          {c.players} {c.players === 1 ? "jugador" : "jugadores"}
        </p>
        <div className="relative z-10 mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-3">
          {owner ? (
            <Link href={`/users/${owner.username}`} className="group/dm flex min-w-0 items-center gap-2 text-sm">
              <Avatar url={owner.avatarUrl} size={24} crown />
              <span className="truncate font-semibold text-[#6fd08c]">
                Creada por <span className="group-hover/dm:underline">{owner.displayName}</span>
              </span>
            </Link>
          ) : (
            <span className="flex items-center gap-2 text-sm text-muted">
              <Avatar url={null} size={24} crown /> Creada por un usuario eliminado
            </span>
          )}
          {c.mine ? (
            <span className="text-xs text-muted">(tú, DM)</span>
          ) : (
            <ConfirmAction
              url={`/api/campaigns/${c.id}/members/${userId}`}
              label="Abandonar"
              question={`¿Abandonar ${c.name}?`}
              confirmLabel="Sí, abandonar"
            />
          )}
        </div>
      </div>
    </article>
  );
}
