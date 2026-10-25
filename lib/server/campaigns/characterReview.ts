import "server-only";
// El DM acepta o deniega la solicitud de un personaje, o saca de la campaña uno ya unido. `ctx` viene de requireDm.
import { Character } from "@/lib/models/Character";
import { Notification } from "@/lib/models/Notification";
import type { MemberContext } from "@/lib/server/campaigns/campaignApi";
import { isValidId } from "@/lib/server/ids";
import { notify } from "@/lib/server/notifications/notify";
import { fail, type Result } from "@/lib/server/result";

type NoticeType = "character_approved" | "character_rejected" | "character_removed";
const LEAVE = { $unset: { campaign: "", origin: "", campaignStatus: "" } };

// El aviso de la solicitud que recibió el DM ya no sirve
const clearRequestNotice = (campaignId: string, characterId: string) =>
  Notification.deleteMany({ type: "character_import_request", character: characterId, campaign: campaignId })
    .catch((err: unknown) => console.error("No se pudo borrar el aviso de la solicitud:", err));

// Aviso al dueño del personaje (si no es el propio DM). Un fallo aquí no deshace el cambio.
async function notifyOwner(
  ctx: MemberContext,
  campaignId: string,
  characterId: string,
  character: { owner: unknown; name: string },
  type: NoticeType,
  errorText: string,
) {
  if (String(character.owner) === ctx.session.id) return;
  try {
    await notify({
      user: String(character.owner),
      type,
      actor: ctx.session.id,
      campaign: campaignId,
      character: characterId,
      text: character.name,
    });
  } catch (err) {
    console.error(errorText, err);
  }
}

// Acepta o deniega una solicitud. Solo si sigue pendiente en esta campaña (si no, 409).
async function resolveRequest(
  ctx: MemberContext,
  campaignId: string,
  characterId: string,
  approve: boolean,
): Promise<Result> {
  const notPending = fail(409, "La solicitud ya no está pendiente.");
  if (!isValidId(characterId)) return notPending;
  const filter = { _id: characterId, campaign: ctx.campaign._id, campaignStatus: "pending" };
  const character = await Character.findOne(filter).select("name owner campaignStatus").lean();
  if (!character || character.campaignStatus !== "pending") return notPending;

  // Condicional: si el jugador la acaba de cancelar, no cambia nada
  const result = await Character.updateOne(filter, approve ? { $set: { campaignStatus: "approved" } } : LEAVE);
  if (result.matchedCount === 0) return notPending;

  await clearRequestNotice(campaignId, characterId);
  await notifyOwner(
    ctx, campaignId, characterId, character,
    approve ? "character_approved" : "character_rejected",
    approve ? "No se pudo avisar al jugador de la aceptación:" : "No se pudo avisar al jugador de la denegación:",
  );
  return { ok: true };
}

export const approveCharacter = (ctx: MemberContext, campaignId: string, characterId: string) =>
  resolveRequest(ctx, campaignId, characterId, true);

// Al denegarla, el personaje sale de la campaña (sigue existiendo)
export const rejectCharacter = (ctx: MemberContext, campaignId: string, characterId: string) =>
  resolveRequest(ctx, campaignId, characterId, false);

// Saca un personaje (aprobado o pendiente) de la campaña. El personaje sigue existiendo para su dueño.
export async function removeCampaignCharacter(
  ctx: MemberContext,
  campaignId: string,
  characterId: string,
): Promise<Result> {
  const notFound = fail(404, "Personaje no encontrado.");
  if (!isValidId(characterId)) return notFound;
  const filter = { _id: characterId, campaign: ctx.campaign._id };
  const character = await Character.findOne(filter).select("name owner campaignStatus").lean();
  if (!character) return notFound;

  const result = await Character.updateOne(filter, LEAVE);
  if (result.matchedCount === 0) return notFound;

  // Si estaba pendiente, el aviso de la solicitud que recibió el DM ya no sirve
  if (character.campaignStatus === "pending") await clearRequestNotice(campaignId, characterId);

  await notifyOwner(
    ctx, campaignId, characterId, character, "character_removed",
    "No se pudo avisar al jugador de que se quitó su personaje:",
  );
  return { ok: true };
}
