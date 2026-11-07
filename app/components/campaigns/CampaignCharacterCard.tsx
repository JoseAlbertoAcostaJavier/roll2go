import Link from "next/link";
import { User as UserIcon } from "lucide-react";
import { STATUS, StatusIcon, type CharacterStatus } from "@/app/components/characters/sheet/StatusBadge";
import { CharacterMenu, ReviewButtons } from "@/app/components/campaigns/CharacterActions";

export type CampaignCharacterData = {
  id: string;
  name: string;
  portraitUrl: string | null;
  summary: string; // «Especie Clase N» o, con multiclase, «Especie Clase N / Clase M»
  status: CharacterStatus;
  pending: boolean;
  owner: { username: string; displayName: string } | null; // null: cuenta borrada
  isOwn: boolean; // es de quien mira
};

/* Tarjeta de un personaje en la sección Personajes de la campaña (spec §8.1). Una solicitud pendiente sale en gris
   para su dueño y con Aceptar/Denegar para el DM (el resto de miembros ni la recibe). */
export default function CampaignCharacterCard({ character: c, campaignId, isDm }: {
  character: CampaignCharacterData;
  campaignId: string;
  isDm: boolean;
}) {
  const s = STATUS[c.status] ?? STATUS.active;
  const dimmed = c.pending && !isDm;

  return (
    <li className="flex items-start gap-3 rounded-lg border border-line bg-surface p-4">
      <div className={`relative shrink-0 ${dimmed ? "grayscale opacity-60" : ""}`}>
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-panel text-muted">
          {c.portraitUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.portraitUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <UserIcon size={30} aria-hidden="true" />
          )}
        </div>
        <span
          title={s.label}
          className={`absolute -left-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface ${s.color}`}
        >
          <StatusIcon status={c.status} size={12} />
          <span className="sr-only">Estado: {s.label}</span>
        </span>
      </div>

      <div className="min-w-0 flex-1">
        {/* El aviso «Pendiente de aprobación» queda fuera del gris, para que se lea bien */}
        <div className={dimmed ? "grayscale opacity-60" : ""}>
          <p className="truncate font-heading font-bold">
            <Link href={`/characters/${c.id}`} className="text-fg hover:underline">{c.name}</Link>
          </p>
          {c.summary && <p className="truncate text-sm text-muted">{c.summary}</p>}
          {c.owner ? (
            <Link href={`/users/${c.owner.username}`} className="block truncate text-sm hover:underline">
              {c.owner.displayName}
            </Link>
          ) : (
            <p className="text-sm text-muted">Desconocido</p>
          )}
        </div>
        {c.pending && <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">Pendiente de aprobación</p>}
        {/* Debajo del texto y no a la derecha, para que el nombre quepa a 375 px */}
        {c.pending && isDm && (
          <div className="mt-2">
            <ReviewButtons campaignId={campaignId} characterId={c.id} name={c.name} />
          </div>
        )}
      </div>

      {/* Al DM, una solicitud pendiente solo le muestra Aceptar/Denegar (Denegar ya la saca de la campaña) */}
      {(isDm ? !c.pending : c.isOwn) && (
        <div className="shrink-0">
          <CharacterMenu campaignId={campaignId} characterId={c.id} name={c.name} isDm={isDm} isOwn={c.isOwn} pending={c.pending} />
        </div>
      )}
    </li>
  );
}
