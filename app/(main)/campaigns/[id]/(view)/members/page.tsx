import { Crown, User as UserIcon } from "lucide-react";
import ConfirmAction from "@/app/components/ConfirmAction";
import InviteLink from "@/app/components/InviteLink";
import { getCampaignAccess } from "@/lib/campaignAccess";
import { Campaign } from "@/lib/Campaign";
import { User } from "@/lib/User";
import { MAX_MEMBERS } from "@/lib/members";

const heading = "mb-3 border-l-4 border-brand pl-3 font-heading text-xl font-bold";

export default async function CampaignMembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, campaign, isDm } = await getCampaignAccess(id);

  // Participantes: el DM primero y después por orden alfabético
  const ownerId = String(campaign.owner);
  const users = await User.find({ _id: { $in: campaign.members } }).select("username").lean();
  const people = users
    .map((u) => ({ id: String(u._id), name: String(u.username) }))
    .sort((a, b) => Number(b.id === ownerId) - Number(a.id === ownerId) || a.name.localeCompare(b.name, "es"));

  // El enlace de invitación solo se carga (y se envía a la página) si eres el DM
  let invite: { code: string | null; expiresAt: string | null } = { code: null, expiresAt: null };
  if (isDm) {
    const c = await Campaign.findById(id).select("+inviteCode +inviteExpires").lean();
    const valid = !!c?.inviteCode && (!c.inviteExpires || c.inviteExpires > new Date());
    invite = {
      code: valid ? c.inviteCode : null,
      expiresAt: valid && c.inviteExpires ? c.inviteExpires.toISOString() : null,
    };
  }

  return (
    <div className="space-y-8">
      {isDm && (
        <section>
          <h2 className={heading}>Invitar jugadores</h2>
          <InviteLink campaignId={id} initialCode={invite.code} initialExpiresAt={invite.expiresAt} />
        </section>
      )}

      <section>
        <h2 className={heading}>
          Jugadores{" "}
          <span className="text-sm font-normal text-muted">
            ({people.length} de {MAX_MEMBERS})
          </span>
        </h2>
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {people.map((p) => {
            const isOwner = p.id === ownerId;
            const isMe = p.id === session.id;
            return (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-panel text-muted">
                    {isOwner ? <Crown size={14} aria-hidden="true" /> : <UserIcon size={14} aria-hidden="true" />}
                  </span>
                  <span className="font-semibold">{p.name}</span>
                  {isOwner && <span className="rounded bg-brand/15 px-2 py-0.5 text-xs text-brand-soft">DM</span>}
                  {isMe && <span className="text-xs text-muted">(tú)</span>}
                </span>

                {/* El DM puede expulsar a los jugadores; un jugador solo puede abandonar él mismo */}
                {isDm && !isOwner && (
                  <ConfirmAction
                    url={`/api/campaigns/${id}/members/${p.id}`}
                    label="Expulsar"
                    question={`¿Estas seguro de que quieres expulsar a ${p.name}?`}
                    confirmLabel="Sí, expulsar."
                  />
                )}
                {!isDm && isMe && (
                  <ConfirmAction
                    url={`/api/campaigns/${id}/members/${p.id}`}
                    label="Abandonar campaña"
                    question="¿Estas seguro? Los personajes que crearas se quedarán sin campaña."
                    confirmLabel="Sí, abandonar."
                    redirectTo="/campaigns"
                  />
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}