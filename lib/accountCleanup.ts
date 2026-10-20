import { Campaign } from "@/lib/Campaign";
import { CampaignImage } from "@/lib/CampaignImage";
import { CampaignLogEntry } from "@/lib/CampaignLogEntry";
import { HomebrewEntry } from "@/lib/HomebrewEntry";
import { Character } from "@/lib/Character";
import { Friendship } from "@/lib/Friendship";
import { User } from "@/lib/User";
import { Message } from "@/lib/Message";
import { Notification } from "@/lib/Notification";
/* Borra una campaña y todo lo que depende de ella. Los personajes NO se borran: se quedan sin campaña.
   La campaña se borra antes que las imágenes: si algo falla a medias, volver a intentarlo es seguro. */
export async function deleteCampaignData(campaign: {
  _id: unknown;
  imageId?: unknown;
  logoId?: unknown;
}) {
  await Character.updateMany(
    { campaign: campaign._id },
    { $unset: { campaign: "", origin: "" } },
  );
  await HomebrewEntry.deleteMany({ campaign: campaign._id });
  await CampaignLogEntry.deleteMany({ campaign: campaign._id });
  await Campaign.deleteOne({ _id: campaign._id });

  const imageIds = [campaign.imageId, campaign.logoId].filter(Boolean);
  if (imageIds.length) {
    try {
      await CampaignImage.deleteMany({ _id: { $in: imageIds } });
    } catch (err) {
      console.error("No se pudieron borrar las imágenes de la campaña:", err); // solo quedan huérfanas
    }
  }
}

// Borra una cuenta y sus datos personales (derecho de supresión)
export async function deleteUserData(userId: string) {
  // 1. Sus campañas, con todo su contenido
  const owned = await Campaign.find({ owner: userId }).select("imageId logoId");
  for (const c of owned) await deleteCampaignData(c);

  // 2. Sale de las campañas donde solo era participante y se borran sus notas
  await Campaign.updateMany(
    { members: userId },
    { $pull: { members: userId } },
  );
  await CampaignLogEntry.deleteMany({ author: userId });

  // 3. Sus personajes y sus amistades
  await Character.deleteMany({ owner: userId });
  await Friendship.deleteMany({
    $or: [{ requester: userId }, { recipient: userId }],
  });
  await Message.deleteMany({ $or: [{ from: userId }, { to: userId }] });
  await Notification.deleteMany({ $or: [{ user: userId }, { actor: userId }] });
  // 4. Todas las imágenes que subió (avatar incluido) y, por último, la cuenta
  await CampaignImage.deleteMany({ owner: userId });
  await User.deleteOne({ _id: userId });
}
