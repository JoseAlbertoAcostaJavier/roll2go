import ConfirmAction from "@/app/components/ConfirmAction";
import ExpelMember from "@/app/components/ExpelMember";
import InviteFriends, { type FriendOption } from "@/app/components/InviteFriends";
import InviteLink from "@/app/components/InviteLink";
import UserLink from "@/app/components/UserLink";
import { getCampaignAccess } from "@/lib/campaignAccess";
import { Campaign } from "@/lib/Campaign";
import { CampaignInvite } from "@/lib/CampaignInvite";
import { blockedIdsOf } from "@/lib/blocks";
import { friendIdsOf } from "@/lib/friends";
import { MAX_MEMBERS } from "@/lib/members";
import { loadUserCards } from "@/lib/userCards";

const heading = "mb-3 border-l-4 border-brand pl-3 font-heading text-xl font-bold";
const list = "divide-y divide-line rounded-lg border border-line bg-surface";
const row = "flex flex-wrap items-center justify-between gap-3 px-4 py-3";

export default async function CampaignMembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, campaign, isDm } = await getCampaignAccess(id);

  const ownerId = String(campaign.owner);
  const memberIds: string[] = campaign.members.map(String);

  // Datos que solo ve el DM: enlace, bloqueados de la campaña, invitaciones pendientes y amigos invitables
  let invite: { code: string | null; expiresAt: string | null } = { code: null, expiresAt: null };
  let bannedIds: string[] = [];
  let pendingIds: string[] = [];
  let eligibleIds: string[] = [];
  if (isDm) {
    const c = await Campaign.findById(id).select("+inviteCode +inviteExpires banned").lean();
    const valid = !!c?.inviteCode && (!c.inviteExpires || c.inviteExpires > new Date());
    invite = {
      code: valid ? c.inviteCode : null,
      expiresAt: valid && c.inviteExpires ? c.inviteExpires.toISOString() : null,
    };
    bannedIds = (c?.banned ?? []).map(String);
    const pending = await CampaignInvite.find({ campaign: id }).sort({ createdAt: -1 }).select("user").lean();
    pendingIds = pending.map((p) => String(p.user));

    const [friendIds, hiddenIds] = await Promise.all([friendIdsOf(session.id), blockedIdsOf(session.id)]);
    const taken = new Set([...memberIds, ...bannedIds, ...pendingIds, ...hiddenIds]);
    eligibleIds = friendIds.filter((f) => !taken.has(f));
  }

  const cards = await loadUserCards([...memberIds, ...bannedIds, ...pendingIds, ...eligibleIds]);
  const friends: FriendOption[] = eligibleIds
    .map((f) => cards.get(f))
    .filter((u) => !!u)
    .map((u) => ({ username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "es"));

  // Participantes: el DM primero y después por orden alfabético
  const people = memberIds
    .map((mid) => ({ id: mid, card: cards.get(mid) }))
    .sort(
      (a, b) =>
        Number(b.id === ownerId) - Number(a.id === ownerId) ||
        (a.card?.displayName ?? "").localeCompare(b.card?.displayName ?? "", "es"),
    );

  return (
    <div className="space-y-8">
      {isDm && (
        <>
          <section>
            <h2 className={heading}>Invitar por enlace</h2>
            <InviteLink campaignId={id} initialCode={invite.code} initialExpiresAt={invite.expiresAt} />
          </section>

          <section>
            <h2 className={heading}>Invitar a tus amigos</h2>
            <InviteFriends campaignId={id} friends={friends} />

            {pendingIds.length > 0 && (
              <div className="mt-5">
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Invitaciones pendientes</h3>
                <ul className={list}>
                  {pendingIds.map((uid) => {
                    const u = cards.get(uid);
                    if (!u) return null;
                    return (
                      <li key={uid} className={row}>
                        <UserLink user={u} size={32} showHandle />
                        <ConfirmAction
                          url={`/api/campaigns/${id}/invites/${u.username}`}
                          label="Cancelar invitación"
                          question={`¿Cancelar la invitación a ${u.displayName}?`}
                          confirmLabel="Sí, cancelar"
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        </>
      )}

      <section>
        <h2 className={heading}>
          Participantes <span className="text-sm font-normal text-muted">({people.length} de {MAX_MEMBERS})</span>
        </h2>
        <ul className={list}>
          {people.map(({ id: uid, card }) => {
            const isOwner = uid === ownerId;
            const isMe = uid === session.id;
            return (
              <li key={uid} className={row}>
                <span className="flex min-w-0 items-center gap-3">
                  {card ? (
                    <UserLink user={card} size={36} crown={isOwner} showHandle />
                  ) : (
                    <span className="text-sm text-muted">Participante eliminado</span>
                  )}
                  {isOwner && <span className="rounded bg-brand/15 px-2 py-0.5 text-xs text-brand-soft">DM</span>}
                  {isMe && <span className="text-xs text-muted">(tú)</span>}
                </span>

                {/* El DM puede expulsar a los jugadores; un jugador solo puede abandonar él mismo */}
                {isDm && !isOwner && <ExpelMember campaignId={id} userId={uid} name={card?.displayName ?? "este participante"} />}
                {!isDm && isMe && (
                  <ConfirmAction
                    url={`/api/campaigns/${id}/members/${uid}`}
                    label="Abandonar campaña"
                    question="¿Abandonar la campaña? Tus personajes se quedarán sin campaña."
                    confirmLabel="Sí, abandonar"
                    redirectTo="/campaigns"
                  />
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {isDm && bannedIds.length > 0 && (
        <section>
          <h2 className={heading}>
            Lista de bloqueados <span className="text-sm font-normal text-muted">({bannedIds.length})</span>
          </h2>
          <p className="mb-3 text-sm text-muted">Estas personas no pueden volver a unirse a la campaña.</p>
          <ul className={list}>
            {bannedIds.map((uid) => {
              const u = cards.get(uid);
              return (
                <li key={uid} className={row}>
                  {u ? <UserLink user={u} size={32} showHandle /> : <span className="text-sm text-muted">Cuenta eliminada</span>}
                  <ConfirmAction
                    url={`/api/campaigns/${id}/banned/${uid}`}
                    label="Desbloquear"
                    question={`¿Permitir que ${u?.displayName ?? "esta persona"} vuelva a unirse?`}
                    confirmLabel="Sí, desbloquear"
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}