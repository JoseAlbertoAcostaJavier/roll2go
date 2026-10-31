import "server-only";
// Participantes de una campaña: expulsar o abandonar, borrar las notas de quien ya no está y desbloquear.
import { Campaign } from "@/lib/models/Campaign";
import { CampaignLogEntry } from "@/lib/models/CampaignLogEntry";
import { Character } from "@/lib/models/Character";
import type { MemberContext } from "@/lib/server/campaigns/campaignApi";
import { isValidId } from "@/lib/server/ids";
import { notify } from "@/lib/server/notifications/notify";
import { fail, type Result } from "@/lib/server/result";

const notFound = () => fail(404, "Participante no encontrado.");

/* El DM expulsa a un jugador, o un jugador se va él mismo (`ctx` de requireMember). `ban` (solo el DM) añade además a
   la persona a la lista de bloqueados de la campaña. El DM no puede irse ni ser expulsado (tendría que borrar la
   campaña). Devuelve cuántas notas suyas quedan, para que el DM decida si borrarlas. */
export async function removeMember(
  ctx: MemberContext,
  campaignId: string,
  userId: string,
  banRequested: boolean,
): Promise<Result<{ notes: number }>> {
  if (!isValidId(userId)) return notFound();
  if (String(ctx.campaign.owner) === userId)
    return fail(400, "El DM no puede abandonar su campaña ni ser expulsado. Para cerrarla, bórrala.");
  const isSelf = userId === ctx.session.id;
  if (!isSelf && !ctx.isDm) return fail(403, "Solo el DM puede expulsar a un participante.");
  const ban = ctx.isDm && !isSelf && banRequested;

  try {
    const result = await Campaign.updateOne(
      { _id: ctx.campaign._id, members: userId },
      ban
        ? { $pull: { members: userId }, $addToSet: { banned: userId } }
        : { $pull: { members: userId } },
    );
    if (result.modifiedCount === 0) return notFound();
    // Sus personajes (aprobados o pendientes) siguen existiendo, pero sin campaña
    await Character.updateMany(
      { campaign: ctx.campaign._id, owner: userId },
      { $unset: { campaign: "", origin: "", campaignStatus: "" } },
    );

    if (!isSelf) {
      try {
        await notify({
          user: userId,
          type: "campaign_removed",
          actor: ctx.session.id,
          campaign: campaignId,
        });
      } catch (err) {
        console.error("No se pudo avisar al expulsado:", err);
      }
    }

    // Sus notas se mantienen
    const notes = await CampaignLogEntry.countDocuments({
      campaign: ctx.campaign._id,
      author: userId,
    });
    return { ok: true, notes };
  } catch (err) {
    console.error("Error al quitar al participante:", err);
    return fail(500, "No se pudo completar la acción. Inténtalo de nuevo.");
  }
}

// Borra las notas de quien ya no está en la campaña (las de un participante activo se borran una a una). Solo el DM.
export async function deleteMemberNotes(ctx: MemberContext, userId: string): Promise<Result<{ deleted: number }>> {
  if (!isValidId(userId)) return notFound();
  if (ctx.campaign.members.some((m) => String(m) === userId))
    return fail(409, "Esta persona sigue en la campaña.");

  try {
    const result = await CampaignLogEntry.deleteMany({
      campaign: ctx.campaign._id,
      author: userId,
    });
    return { ok: true, deleted: result.deletedCount };
  } catch (err) {
    console.error("Error al borrar las notas:", err);
    return fail(500, "No se pudieron borrar las notas. Inténtalo de nuevo.");
  }
}

// Quita a alguien de la lista de bloqueados de la campaña. Solo el DM.
export async function unbanMember(ctx: MemberContext, userId: string): Promise<Result> {
  if (!isValidId(userId)) return fail(404, "Usuario no encontrado.");
  try {
    await Campaign.updateOne(
      { _id: ctx.campaign._id },
      { $pull: { banned: userId } },
    );
    return { ok: true };
  } catch (err) {
    console.error("Error al desbloquear de la campaña:", err);
    return fail(500, "No se pudo desbloquear. Inténtalo de nuevo.");
  }
}
