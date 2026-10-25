import Link from "next/link";
import { Plus } from "lucide-react";
import { getCampaignAccess } from "@/lib/server/campaigns/campaignAccess";
import { listCampaignCharacters } from "@/lib/server/campaigns/queries";
import { system as rpgSystems } from "@/lib/utils/systems";
import CampaignCharacterCard, { type CampaignCharacterData } from "@/app/components/campaigns/CampaignCharacterCard";
import AddCharacterDialog, { type AddableCharacter } from "@/app/components/campaigns/AddCharacterDialog";
import { CharacterNoticeArea, CharacterNotices } from "@/app/components/campaigns/CharacterActions";

export default async function CampaignCharactersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, campaign, isDm } = await getCampaignAccess(id);
  const system = rpgSystems.find((s) => s.id === campaign.systemId);
  const systemName = system?.name ?? campaign.systemId;

  // Personajes de la campaña (las solicitudes pendientes, solo el DM y su dueño) y los propios que se pueden añadir
  const data = await listCampaignCharacters(campaign, session.id, isDm);
  const { rules, canAdd } = data;
  const characters: CampaignCharacterData[] = data.characters;
  const addable: AddableCharacter[] = data.addable;

  const help = !rules.allowed
    ? "Esta campaña no admite personajes."
    : rules.internal && rules.external
      ? "Crea un personaje para esta campaña o añade uno que ya tengas."
      : rules.internal
        ? "Crea tu personaje desde aquí: la campaña no admite personajes creados fuera de ella."
        : "Añade un personaje que ya tengas: la campaña no admite crearlos desde aquí.";
  const reviewed = rules.allowed && rules.external && !isDm ? " El DM tiene que aceptar los que se añaden." : "";

  return (
    <CharacterNotices>
      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-bold uppercase tracking-wide">Personajes</h2>
          <div className="flex flex-wrap gap-2">
            {canAdd && (
              <AddCharacterDialog campaignId={id} characters={addable} isDm={isDm} systemName={systemName} />
            )}
            {rules.allowed && rules.internal && system?.creator && (
              <Link
                href={`/characters/new?${new URLSearchParams({ system: campaign.systemId, campaign: id })}`}
                className="flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-hover"
              >
                <Plus size={14} aria-hidden="true" /> Crear personaje
              </Link>
            )}
          </div>
        </div>
        <p className="mb-5 text-sm text-muted">{help}{reviewed}</p>

        <CharacterNoticeArea />
        {characters.length === 0 ? (
          <div className="rounded-md bg-surface p-4 text-sm text-muted">Aún no hay personajes en esta campaña.</div>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-3">
            {characters.map((c) => (
              <CampaignCharacterCard key={c.id} character={c} campaignId={id} isDm={isDm} />
            ))}
          </ul>
        )}
      </section>
    </CharacterNotices>
  );
}
