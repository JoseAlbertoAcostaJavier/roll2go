import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import mongoose from "mongoose";
import { COOKIE_NAME, verifySession } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Campaign } from "@/lib/Campaign";

/* Sesión + campaña de la dirección actual. Se llama desde el layout y desde cada página, y gracias a
   cache() la consulta se hace una sola vez por visita. Sin sesión redirige al login; si la campaña no
   existe o el usuario no es miembro, da 404 (así ni siquiera se sabe que existe). */
export const getCampaignAccess = cache(async (id: string) => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect(`/sign_in?next=/campaigns/${id}`);
  if (!mongoose.isValidObjectId(id)) notFound();

  await connectDB();
  const campaign = await Campaign.findOne({
    _id: id,
    members: session.id,
  }).lean();
  if (!campaign) notFound();

  return { session, campaign, isDm: String(campaign.owner) === session.id };
});
