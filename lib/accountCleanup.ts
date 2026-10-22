import { Campaign } from "@/lib/Campaign";
import { CampaignImage } from "@/lib/CampaignImage";
import { CampaignLogEntry } from "@/lib/CampaignLogEntry";
import { HomebrewEntry } from "@/lib/HomebrewEntry";
import { Character } from "@/lib/Character";
import { Friendship } from "@/lib/Friendship";
import { User } from "@/lib/User";
import { Message } from "@/lib/Message";
import { Notification } from "@/lib/Notification";
import { Block } from "@/lib/Block";
import { CampaignInvite } from "@/lib/CampaignInvite";
import { ForumPost } from "@/lib/ForumPost";
import { ForumReaction } from "@/lib/ForumReaction";
import { Book } from "@/lib/Book";
import { BookEntry } from "@/lib/BookEntry";

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
  await CampaignInvite.deleteMany({ campaign: campaign._id });
  await ForumReaction.deleteMany({ campaign: campaign._id });
  await ForumPost.deleteMany({ campaign: campaign._id });
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
  await Block.deleteMany({ $or: [{ blocker: userId }, { blocked: userId }] });
  await CampaignInvite.deleteMany({
    $or: [{ user: userId }, { invitedBy: userId }],
  });
  await Campaign.updateMany({ banned: userId }, { $pull: { banned: userId } });
  await Message.deleteMany({ $or: [{ from: userId }, { to: userId }] });
  await Notification.deleteMany({ $or: [{ user: userId }, { actor: userId }] });
  // Foro: sus mensajes (con las respuestas de otros a esos mensajes) y todas sus reacciones
  const mine = await ForumPost.find({ author: userId }).select("_id parent").lean();
  const rootIds = mine.filter((p) => !p.parent).map((p) => p._id);
  const replies = rootIds.length ? await ForumPost.find({ parent: { $in: rootIds } }).select("_id").lean() : [];
  const postIds = [...mine.map((p) => p._id), ...replies.map((r) => r._id)];
  await ForumReaction.deleteMany({ $or: [{ user: userId }, { post: { $in: postIds } }] });
  await ForumPost.deleteMany({ _id: { $in: postIds } });
  await Notification.deleteMany({ post: { $in: postIds } });
  // Sus libros de reglas, con todas sus entradas
  const books = await Book.find({ owner: userId }).select("_id").lean();
  await BookEntry.deleteMany({ book: { $in: books.map((b) => b._id) } });
  await Book.deleteMany({ owner: userId });
  // 4. Todas las imágenes que subió (avatar incluido) y, por último, la cuenta
  await CampaignImage.deleteMany({ owner: userId });
  await User.deleteOne({ _id: userId });
}
