import "server-only";
// El dueño de un personaje lo une a una campaña (queda pendiente hasta que el DM lo acepte) o lo saca de ella.
import { connectDB } from "@/lib/models/mongodb";
import { Campaign } from "@/lib/models/Campaign";
import { Character } from "@/lib/models/Character";
import { Notification } from "@/lib/models/Notification";
import { joinReasons } from "@/lib/server/campaigns/campaignEligibility";
import { OUTDATED_SHEET_ERROR, loadCharacterFor } from "@/lib/server/characters/characterAccess";
import { isValidId } from "@/lib/server/ids";
import { notify } from "@/lib/server/notifications/notify";
import { fail, type Result } from "@/lib/server/result";

const notFound = () => fail(404, "Personaje no encontrado.");
const campaignNotFound = () => fail(404, "Campaña no encontrada.");

/* Solicita unir el personaje a la campaña. Si quien lo pide es el DM, se aprueba al momento; si no, queda pendiente y
   se avisa al DM. Devuelve el estado en que queda. */
export async function requestJoinCampaign(
  userId: string,
  id: string,
  campaignId: string,
): Promise<Result<{ status: "pending" | "approved" }>> {
  if (!isValidId(campaignId)) return campaignNotFound();

  // "write": solo el dueño, y una hoja v1 se convierte antes (si no se puede, no se une)
  const found = await loadCharacterFor(userId, id, "write");
  if (!found) return notFound();
  if (found.outdated) return fail(409, OUTDATED_SHEET_ERROR);

  await connectDB();
  const campaign = await Campaign.findById(campaignId)
    .select("name owner members systemId status characters restrictBooks allowedBooks")
    .lean();
  if (!campaign) return campaignNotFound();

  // Los libros que usa de verdad la hoja (Character.books es solo el filtro del creador y puede estar vacío)
  const [reason] = await joinReasons(userId, [
    { campaign, character: { systemId: found.character.systemId, campaign: found.character.campaign, sheet: found.sheet } },
  ]);
  if (reason) return fail(400, reason);

  const isDm = String(campaign.owner) === userId;
  const status = isDm ? "approved" : "pending";
  // Condicional: si otra solicitud se adelantó (a esta u otra campaña), no se pisa
  const result = await Character.updateOne(
    { _id: id, owner: userId, campaign: { $exists: false } },
    { $set: { campaign: campaignId, origin: "external", campaignStatus: status } },
  );
  if (result.matchedCount === 0) return fail(409, "Este personaje ya está en una campaña.");

  if (!isDm) {
    try {
      await notify({
        user: String(campaign.owner),
        type: "character_import_request",
        actor: userId,
        campaign: campaignId,
        character: id,
        text: found.character.name,
      });
    } catch (err) {
      console.error("No se pudo avisar al DM de la solicitud:", err);
    }
  }
  return { ok: true, status };
}

/* Saca el personaje de su campaña o cancela su solicitud. Si estaba aprobado, se avisa al DM (salvo que el dueño sea
   el propio DM). */
export async function leaveCampaign(userId: string, id: string): Promise<Result> {
  if (!isValidId(id)) return notFound();
  await connectDB();
  const character = await Character.findOne({ _id: id, owner: userId })
    .select("name campaign campaignStatus")
    .lean();
  if (!character) return notFound();
  if (!character.campaign) return fail(409, "Este personaje no está en ninguna campaña.");

  // Los antiguos sin campaignStatus cuentan como aprobados
  const wasPending = character.campaignStatus === "pending";
  // Solo si sigue como se leyó (si el DM lo acaba de aceptar o quitar, se recarga)
  const result = await Character.updateOne(
    {
      _id: id,
      owner: userId,
      campaign: character.campaign,
      campaignStatus: wasPending ? "pending" : { $ne: "pending" },
    },
    { $unset: { campaign: "", origin: "", campaignStatus: "" } },
  );
  if (result.matchedCount === 0) return fail(409, "El personaje ha cambiado; recarga la página.");

  if (wasPending) {
    // Al cancelar una solicitud, el aviso que recibió el DM ya no sirve
    await Notification.deleteMany({ type: "character_import_request", character: id, campaign: String(character.campaign) })
      .catch((err: unknown) => console.error("No se pudo borrar el aviso de la solicitud:", err));
  } else {
    try {
      const campaign = await Campaign.findById(character.campaign).select("owner").lean();
      if (campaign && String(campaign.owner) !== userId) {
        await notify({
          user: String(campaign.owner),
          type: "character_left",
          actor: userId,
          campaign: String(character.campaign),
          character: id,
          text: character.name,
        });
      }
    } catch (err) {
      console.error("No se pudo avisar al DM de la salida del personaje:", err);
    }
  }
  return { ok: true };
}
