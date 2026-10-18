import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { COOKIE_NAME, verifySession } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Campaign } from "@/lib/Campaign";

export type Session = { id: string; username: string };
type CampaignLite = {
  _id: mongoose.Types.ObjectId;
  owner: mongoose.Types.ObjectId;
  members: mongoose.Types.ObjectId[];
};
type Failure = { error: NextResponse };
type Success = {
  error?: undefined;
  session: Session;
  campaign: CampaignLite;
  isDm: boolean;
};

export async function sessionOf(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  return token ? verifySession(token) : null;
}

/* Exige sesión y que el usuario sea miembro de la campaña. Si no existe o no eres miembro, la respuesta es la
   misma (404): ni siquiera se sabe que existe. Uso: const ctx = await requireMember(...); if (ctx.error) return ctx.error; */
export async function requireMember(
  req: NextRequest,
  id: string,
): Promise<Failure | Success> {
  const session = await sessionOf(req);
  if (!session)
    return {
      error: NextResponse.json({ error: "Inicia sesión." }, { status: 401 }),
    };

  const notFound = {
    error: NextResponse.json(
      { error: "Campaña no encontrada." },
      { status: 404 },
    ),
  };
  if (!mongoose.isValidObjectId(id)) return notFound;

  await connectDB();
  const campaign = await Campaign.findOne({ _id: id, members: session.id })
    .select("owner members")
    .lean();
  if (!campaign) return notFound;

  return {
    session,
    campaign: campaign as unknown as CampaignLite,
    isDm: String(campaign.owner) === session.id,
  };
}

// Igual que requireMember, pero además exige ser el DM
export async function requireDm(
  req: NextRequest,
  id: string,
): Promise<Failure | Success> {
  const ctx = await requireMember(req, id);
  if (ctx.error) return ctx;
  if (!ctx.isDm)
    return {
      error: NextResponse.json(
        { error: "Solo el DM puede hacer esto." },
        { status: 403 },
      ),
    };
  return ctx;
}
