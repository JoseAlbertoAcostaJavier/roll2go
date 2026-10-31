import "server-only";
// Perfil público (nombre visible, pronombres, ubicación, biografía y foto) y libros que el usuario dice tener
import { connectDB } from "@/lib/models/mongodb";
import { CampaignImage } from "@/lib/models/CampaignImage";
import { User } from "@/lib/models/User";
import { storeImage, type NewImage } from "@/lib/server/campaigns/campaignInput";
import { officialBookIds } from "@/lib/server/catalog/books";
import { fail, type Result } from "@/lib/server/result";

export type ProfileInput = { displayName: string; pronouns: string; location: string; bio: string };

/* Guarda el perfil (ya validado). Con `newAvatar` sustituye la foto; con `removeAvatar`, la quita. La foto antigua se
   borra después de guardar; si el guardado falla, se borra la nueva. */
export async function updateProfile(
  userId: string,
  fields: ProfileInput,
  newAvatar: NewImage | undefined,
  removeAvatar: boolean,
): Promise<Result> {
  await connectDB();
  const user = await User.findById(userId).select("avatarId");
  if (!user) return fail(401, "Inicia sesión.");

  const { displayName, pronouns, location, bio } = fields;
  const set: Record<string, unknown> = {
    displayName,
    displayNameLower: displayName.toLowerCase(),
    pronouns,
    location,
    bio,
  };
  const unset: Record<string, ""> = {};
  let createdId: unknown;
  let oldAvatar: unknown;

  try {
    if (newAvatar) {
      createdId = await storeImage(newAvatar, userId);
      oldAvatar = user.avatarId;
      set.avatarId = createdId;
    } else if (removeAvatar && user.avatarId) {
      oldAvatar = user.avatarId;
      unset.avatarId = "";
    }
    await User.updateOne({ _id: user._id }, Object.keys(unset).length ? { $set: set, $unset: unset } : { $set: set });
  } catch (err) {
    if (createdId) await CampaignImage.deleteOne({ _id: createdId });
    console.error("Error al guardar el perfil:", err);
    return fail(500, "No se pudo guardar el perfil. Inténtalo de nuevo.");
  }

  if (oldAvatar) {
    try {
      await CampaignImage.deleteOne({ _id: oldAvatar });
    } catch (err) {
      console.error("No se pudo borrar la foto antigua:", err);
    }
  }
  return { ok: true };
}

// Ids de los libros oficiales que el usuario tiene
export async function ownedBooksOf(userId: string): Promise<string[]> {
  await connectDB();
  const me = await User.findById(userId).select("ownedBooks").lean();
  return me?.ownedBooks ?? [];
}

// Sustituye la lista de libros del usuario. Solo se guardan ids de libros oficiales existentes; devuelve la lista.
export async function setOwnedBooks(userId: string, requested: string[]): Promise<string[]> {
  const ownedBooks = await officialBookIds(requested);
  await connectDB();
  await User.updateOne({ _id: userId }, { $set: { ownedBooks } });
  return ownedBooks;
}
