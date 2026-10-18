import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import JoinButton from "@/app/components/JoinButton";
import { COOKIE_NAME, verifySession } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Campaign } from "@/lib/Campaign";
import { User } from "@/lib/User";
import { system as rpgSystems } from "@/lib/systems";
import { INVITE_REGEX } from "@/lib/members";

export const metadata: Metadata = { title: "Unirse a una campaña" };

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  // Sin sesión: al login, y de vuelta aquí al entrar
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect(`/sign_in?next=${encodeURIComponent(`/join/${code}`)}`);

  let campaign = null;
  if (INVITE_REGEX.test(code)) {
    await connectDB();
    campaign = await Campaign.findOne({
      inviteCode: code,
      $or: [{ inviteExpires: { $exists: false } }, { inviteExpires: { $gt: new Date() } }],
    })
      .select("name systemId shortDescription owner members imageId")
      .lean();
  }

  // Si ya eres miembro, directo a la campaña
  if (campaign && campaign.members.some((m: unknown) => String(m) === session.id)) {
    redirect(`/campaigns/${campaign._id}`);
  }

  const shell = "mx-auto max-w-lg px-5 py-14";

  if (!campaign) {
    return (
      <div className={shell}>
        <div className="rounded-lg border border-line bg-panel p-6 text-center">
          <h1 className="mb-2 font-heading text-2xl font-extrabold">Enlace no válido</h1>
          <p className="mb-5 text-sm text-muted">
            Este enlace de invitación no existe, ha caducado o el DM lo ha desactivado. Pídele uno nuevo.
          </p>
          <Link href="/campaigns" className="font-semibold text-brand-soft hover:underline">
            Ir a mis campañas
          </Link>
        </div>
      </div>
    );
  }

  const owner = await User.findById(campaign.owner).select("username").lean();
  const systemName = rpgSystems.find((s) => s.id === campaign.systemId)?.name ?? campaign.systemId;
  const players = Math.max(0, (campaign.members?.length ?? 1) - 1);

  return (
    <div className={shell}>
      <div className="overflow-hidden rounded-lg border border-line bg-panel">
        {campaign.imageId && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/images/${campaign.imageId}`} alt="" className="h-40 w-full object-cover" />
        )}
        <div className="p-6">
          <p className="mb-1 text-sm text-muted">Te han invitado a la campaña</p>
          <h1 className="mb-1 font-heading text-2xl font-extrabold">{campaign.name}</h1>
          <p className="mb-3 text-sm text-muted">
            {systemName} · DM: <span className="font-semibold text-[#6fd08c]">{owner?.username ?? "Desconocido"}</span> ·{" "}
            {players} {players === 1 ? "participante" : "participantes"}
          </p>
          {campaign.shortDescription && <p className="mb-5 text-sm text-muted">{campaign.shortDescription}</p>}
          <JoinButton code={code} />
        </div>
      </div>
    </div>
  );
}