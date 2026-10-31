import "server-only";
// Notas del diario de campaña: crear (cualquier miembro), editar (su autor) y borrar (su autor o el DM).
// `ctx` viene de requireMember; `value`, de parseLogBody.
import { CampaignLogEntry } from "@/lib/models/CampaignLogEntry";
import type { MemberContext } from "@/lib/server/campaigns/campaignApi";
import type { parseLogBody } from "@/lib/server/campaigns/logInput";
import { isValidId } from "@/lib/server/ids";
import { notify } from "@/lib/server/notifications/notify";
import { fail, type Result } from "@/lib/server/result";

type LogValue = ReturnType<typeof parseLogBody>["value"];

const notFound = () => fail(404, "Nota no encontrada.");

// Una nota privada ajena solo la ven su autor y el DM: para el resto, es como si no existiera
async function loadVisible(ctx: MemberContext, entryId: string) {
  if (!isValidId(entryId)) return null;
  const entry = await CampaignLogEntry.findOne({
    _id: entryId,
    campaign: ctx.campaign._id,
  });
  if (!entry) return null;
  const visible =
    entry.visibility === "public" || String(entry.author) === ctx.session.id || ctx.isDm;
  return visible ? entry : null;
}

export async function createLogEntry(
  ctx: MemberContext,
  campaignId: string,
  value: LogValue,
): Promise<Result<{ id: string }>> {
  try {
    const entry = await CampaignLogEntry.create({
      campaign: ctx.campaign._id,
      author: ctx.session.id,
      ...value,
    });
    // Las notas públicas avisan al resto de participantes. Las privadas no avisan a nadie.
    if (value.visibility === "public") {
      const others = ctx.campaign.members
        .map(String)
        .filter((m) => m !== ctx.session.id);
      await Promise.all(
        others.map((user) =>
          notify({
            user,
            type: "campaign_note",
            actor: ctx.session.id,
            campaign: campaignId,
          }).catch((err) =>
            console.error("No se pudo avisar de la nota:", err),
          ),
        ),
      );
    }
    return { ok: true, id: String(entry._id) };
  } catch (err) {
    console.error("Error al crear la nota:", err);
    return fail(500, "No se pudo guardar la nota. Inténtalo de nuevo.");
  }
}

export async function updateLogEntry(ctx: MemberContext, entryId: string, value: LogValue): Promise<Result> {
  try {
    const entry = await loadVisible(ctx, entryId);
    if (!entry) return notFound();
    if (String(entry.author) !== ctx.session.id)
      return fail(403, "Solo el autor puede editar la nota.");
    entry.set(value);
    await entry.save(); // actualiza updatedAt
    return { ok: true };
  } catch (err) {
    console.error("Error al editar la nota:", err);
    return fail(500, "No se pudo guardar la nota. Inténtalo de nuevo.");
  }
}

export async function deleteLogEntry(ctx: MemberContext, entryId: string): Promise<Result> {
  try {
    const entry = await loadVisible(ctx, entryId);
    if (!entry) return notFound();
    if (String(entry.author) !== ctx.session.id && !ctx.isDm)
      return fail(403, "No puedes borrar esta nota.");
    await entry.deleteOne();
    return { ok: true };
  } catch (err) {
    console.error("Error al borrar la nota:", err);
    return fail(500, "No se pudo borrar la nota. Inténtalo de nuevo.");
  }
}
