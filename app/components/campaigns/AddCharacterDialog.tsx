"use client";

import { useState } from "react";
import { LoaderCircle, UserPlus } from "lucide-react";
import { CampaignDialog, useCampaignRequest } from "@/app/components/campaigns/CharacterActions";

export type AddableCharacter = {
  id: string;
  name: string;
  summary: string;
  /** Por qué no puede unirse (texto de canRequestJoin, con los nombres de los libros); null si puede. */
  reason: string | null;
};

/* «Añadir personaje»: los personajes de quien mira, del sistema de la campaña y sin campaña. Los que no cumplen las
   reglas salen desactivados con el motivo. Al elegir uno se envía la solicitud (el DM lo une al momento). */
export default function AddCharacterDialog({ campaignId, characters, isDm, systemName }: {
  campaignId: string;
  characters: AddableCharacter[];
  isDm: boolean;
  systemName: string;
}) {
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const { send, loading, error, clearError } = useCampaignRequest({ inlineErrors: true });

  async function add(c: AddableCharacter) {
    setPicked(c.id);
    const ok = await send(`/api/characters/${c.id}/campaign`, "POST", (data) =>
      data.status === "approved"
        ? `${c.name} se ha unido a la campaña.`
        : `Has solicitado unir a ${c.name}. El DM tiene que aceptarlo.`,
    { campaignId });
    setPicked(null);
    if (ok) setOpener(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          clearError();
          setOpener(e.currentTarget);
        }}
        aria-haspopup="dialog"
        className="flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm font-bold transition-colors hover:border-brand hover:text-white"
      >
        <UserPlus size={14} aria-hidden="true" /> Añadir personaje
      </button>

      {opener && (
        <CampaignDialog title="Añadir personaje" opener={opener} onClose={() => !loading && setOpener(null)}>
          <p className="mb-4 text-sm text-muted">
            {isDm
              ? "Elige uno de tus personajes sin campaña. Como eres el DM, se unirá al momento."
              : "Elige uno de tus personajes sin campaña. El DM tendrá que aceptar la solicitud."}
          </p>
          {characters.length === 0 ? (
            <p className="rounded-md bg-surface p-3 text-sm text-muted">
              No tienes personajes de {systemName} sin campaña.
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
              {characters.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-semibold ${c.reason ? "text-muted" : ""}`}>{c.name}</p>
                    {c.summary && <p className="truncate text-sm text-muted">{c.summary}</p>}
                    {c.reason && <p className="mt-1 text-xs text-brand-soft">{c.reason}</p>}
                  </div>
                  <button
                    type="button"
                    disabled={!!c.reason || loading}
                    onClick={() => add(c)}
                    aria-label={`${isDm ? "Añadir" : "Solicitar"} a ${c.name}`}
                    className="flex items-center gap-2 rounded-md bg-brand px-3 py-1.5 text-sm font-bold text-white transition-colors enabled:hover:bg-brand-hover disabled:opacity-40"
                  >
                    {picked === c.id && <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />}
                    {isDm ? "Añadir" : "Solicitar"}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error && <p role="alert" className="mt-4 text-sm text-brand-soft">{error}</p>}
          <div className="mt-5 flex justify-end">
            {/* El foco empieza aquí y no en el primer «Añadir», para no enviar nada con un Intro sin querer */}
            <button
              type="button"
              data-autofocus
              onClick={() => setOpener(null)}
              disabled={loading}
              className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors enabled:hover:text-white disabled:opacity-50"
            >
              Cerrar
            </button>
          </div>
        </CampaignDialog>
      )}
    </>
  );
}
