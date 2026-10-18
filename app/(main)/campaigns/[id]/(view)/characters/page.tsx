import { getCampaignAccess } from "@/lib/campaignAccess";
import { Character } from "@/lib/Character";
import { User } from "@/lib/User";

export default async function CampaignCharactersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { campaign } = await getCampaignAccess(id);

  const characters = await Character.find({ campaign: campaign._id })
    .select("name owner origin")
    .sort({ createdAt: 1 })
    .lean();

  const ownerIds = [...new Set(characters.map((c) => String(c.owner)))];
  const owners = await User.find({ _id: { $in: ownerIds } }).select("username").lean();
  const ownerName = new Map<string, string>(owners.map((u): [string, string] => [String(u._id), String(u.username)]));

  return (
    <section>
      <h2 className="mb-2 font-heading text-lg font-bold uppercase tracking-wide">Personajes</h2>
      <p className="mb-5 text-sm text-muted">Los personajes de los participantes de esta campaña.</p>

      {characters.length === 0 ? (
        <div className="rounded-md bg-surface p-4 text-sm text-muted">No se han encontrado personajes.</div>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(240px,100%),1fr))] gap-3">
          {characters.map((c) => (
            <li key={String(c._id)} className="rounded-lg border border-line bg-surface p-4">
              <p className="font-heading font-bold">{c.name}</p>
              <p className="text-sm text-muted">{ownerName.get(String(c.owner)) ?? "Desconocido"}</p>
              {c.origin && (
                <span className="mt-2 inline-block rounded bg-panel px-2 py-0.5 text-xs text-muted">
                  {c.origin === "internal" ? "Interno" : "Externo"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}