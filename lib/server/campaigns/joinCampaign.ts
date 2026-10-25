import "server-only";
import { connectDB } from "@/lib/models/mongodb";
import { Campaign } from "@/lib/models/Campaign";
import { Block } from "@/lib/models/Block";
import { INVITE_REGEX, MAX_MEMBERS } from "@/lib/server/campaigns/members";
import { notify } from "@/lib/server/notifications/notify";
import { fail, type Result } from "@/lib/server/result";

export type JoinResult = "ok" | "already" | "banned" | "full" | "missing";

export async function joinCampaign(
  campaignId: unknown,
  userId: string,
): Promise<JoinResult> {
  const current = await Campaign.findById(campaignId)
    .select("members banned")
    .lean();
  if (!current) return "missing";
  if (current.members.some((m: unknown) => String(m) === userId))
    return "already";
  if ((current.banned ?? []).some((b: unknown) => String(b) === userId))
    return "banned";

  // Atómico: solo añade si todavía hay hueco (el elemento nº MAX_MEMBERS no existe) y no está bloqueado
  const updated = await Campaign.findOneAndUpdate(
    {
      _id: campaignId,
      banned: { $ne: userId },
      [`members.${MAX_MEMBERS - 1}`]: { $exists: false },
    },
    { $addToSet: { members: userId } },
  ).select("owner");
  if (!updated) return "full";

  // Aviso al DM (y correo, si lo tiene activado). Si falla, la persona ya ha entrado igualmente.
  try {
    await notify({
      user: String(updated.owner),
      type: "campaign_joined",
      actor: userId,
      campaign: String(campaignId),
    });
  } catch (err) {
    console.error("No se pudo avisar al DM:", err);
  }
  return "ok";
}

// Unirse con el código de un enlace de invitación. `already`: ya eras miembro.
export async function joinByInviteCode(
  userId: string,
  code: string,
): Promise<Result<{ id: string; already: boolean }>> {
  const invalid = () => fail(404, "El enlace no es válido o ha caducado.");
  if (!INVITE_REGEX.test(code)) return invalid();

  try {
    await connectDB();
    const campaign = await Campaign.findOne({
      inviteCode: code,
      $or: [
        { inviteExpires: { $exists: false } },
        { inviteExpires: { $gt: new Date() } },
      ],
    }).select("owner");
    if (!campaign) return invalid();

    // Quien ha sido bloqueado por el DM recibe el mismo mensaje que con un enlace caducado
    if (await Block.exists({ blocker: campaign.owner, blocked: userId }))
      return invalid();

    const result = await joinCampaign(campaign._id, userId);
    if (result === "banned" || result === "missing") return invalid();
    if (result === "full")
      return fail(409, "La campaña ha alcanzado el máximo de participantes.");
    return { ok: true, id: String(campaign._id), already: result === "already" };
  } catch (err) {
    console.error("Error al unirse a la campaña:", err);
    return fail(500, "No se pudo completar la unión. Inténtalo de nuevo.");
  }
}
