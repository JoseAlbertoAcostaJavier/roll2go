import { Campaign } from "@/lib/Campaign";
import { MAX_MEMBERS } from "@/lib/members";
import { notify } from "@/lib/notify";

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
