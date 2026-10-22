import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Campaign } from "@/lib/Campaign";
import { HomebrewEntry } from "@/lib/HomebrewEntry";
import { bbcodeToText } from "@/lib/bbcode";
import { booksByIds } from "@/lib/rules/books";
const MAX_CONTEXT_CHARS = 12000; // ~3.000-4.000 tokens: de sobra para una campaña normal

// Quita < y > para que un texto escrito por un usuario no pueda "cerrar" las etiquetas del contexto
const clean = (s: unknown) =>
  String(s ?? "")
    .replace(/[<>]/g, "")
    .trim();

export async function loadCampaignContext(userId: string, campaignId: string) {
  if (
    !mongoose.isValidObjectId(campaignId) ||
    !mongoose.isValidObjectId(userId)
  )
    return null;
  await connectDB();

  // Solo se carga si el usuario es miembro: lo decide el servidor, nunca el navegador
  const campaign = await Campaign.findOne({
    _id: campaignId,
    members: userId,
  }).lean();
  if (!campaign) return null;

  const isDm = String(campaign.owner) === userId;
  const entries = await HomebrewEntry.find({
    campaign: campaign._id,
    // Los jugadores no reciben las entradas del DJ
    ...(isDm ? {} : { visibility: "players" }),
  })
    .sort({ kind: 1, name: 1 })
    .limit(200)
    .lean();

  const parts: string[] = [];
  if (campaign.shortDescription)
    parts.push(`<resumen>\n${clean(campaign.shortDescription)}\n</resumen>`);
  if (campaign.restrictBooks) {
    const names = (await booksByIds(campaign.allowedBooks as string[]))
      .filter((b) => b.systemId === campaign.systemId)
      .map((b) => b.name);
    parts.push(
      `<libros_permitidos>\n${names.join(", ")}\n</libros_permitidos>`,
    );
  }
  // Las notas privadas solo se cargan (y solo se envían a Gemini) si pregunta el DM
  if (isDm) {
    const dm = await Campaign.findById(campaign._id)
      .select("+privateNotes")
      .lean();
    if (dm?.privateNotes)
      parts.push(`<notas_del_dm>\n${clean(dm.privateNotes)}\n</notas_del_dm>`);
  }
  // ...aquí sigue el bloque <homebrew> que ya tenías...
  if (entries.length) {
    const lines = entries.map(
      (e) => `[${e.kind}] ${clean(e.name)}: ${clean(e.content)}`,
    );
    parts.push(`<homebrew>\n${lines.join("\n")}\n</homebrew>`);
  }  
  // La descripción va al final porque es lo más largo: si hay que recortar, se recorta ella
  const lore = bbcodeToText(campaign.description ?? "");
  if (lore) parts.push(`<trasfondo>\n${clean(lore)}\n</trasfondo>`);

  let body = parts.join("\n");
  if (body.length > MAX_CONTEXT_CHARS)
    body = body.slice(0, MAX_CONTEXT_CHARS) + "\n[...contexto recortado]";

  return {
    systemId: campaign.systemId as string,
    isDm,
    context: `<campana nombre="${clean(campaign.name)}">\n${body}\n</campana>`,
  };
}
