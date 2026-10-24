"use client";

import { useState } from "react";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { CampaignDialog, useCampaignRequest } from "@/app/components/campaigns/CharacterActions";

/* Controles de campaña de la ficha para el dueño (spec §8.2): unir el personaje a una campaña, cancelar la solicitud
   o quitarlo. Los avisos de resultado los pinta el `CharacterNoticeArea` de la cabecera. */

export type JoinableCampaign = {
  id: string;
  name: string;
  /** Quien mira es el DM (se une al momento). */
  isDm: boolean;
  /** Por qué no puede unirse (texto de canRequestJoin, con los nombres de los libros); null si puede. */
  reason: string | null;
};

const smallButton =
  "rounded-md border border-line px-2 py-0.5 text-xs font-semibold text-muted transition-colors hover:border-brand hover:text-white";
const secondary =
  "rounded-md border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors enabled:hover:text-white disabled:opacity-50";
const primary =
  "flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-bold text-white transition-colors enabled:hover:bg-brand-hover disabled:opacity-50";

/** «Unir a una campaña»: las campañas activas de quien mira, del sistema del personaje; las que no lo admiten salen
 *  desactivadas con el motivo. */
export default function JoinCampaignDialog({ characterId, name, campaigns, systemName, onDone }: {
  characterId: string;
  name: string;
  campaigns: JoinableCampaign[];
  systemName: string;
  /** Tras unirlo: la página se refresca y este botón desaparece, así que la cabecera mueve el foco. */
  onDone?: () => void;
}) {
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const { send, loading, error, clearError } = useCampaignRequest({ inlineErrors: true });

  async function join(c: JoinableCampaign) {
    setPicked(c.id);
    const ok = await send(`/api/characters/${characterId}/campaign`, "POST", (data) =>
      data.status === "approved"
        ? `${name} se ha unido a ${c.name}.`
        : `Has solicitado unir a ${name} a ${c.name}. El DM tiene que aceptarlo.`,
    { campaignId: c.id });
    setPicked(null);
    if (ok) {
      setOpener(null);
      onDone?.();
    }
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
        className={smallButton}
      >
        Unir a una campaña
      </button>

      {opener && (
        <CampaignDialog title="Unir a una campaña" opener={opener} onClose={() => !loading && setOpener(null)}>
          <p className="mb-4 text-sm text-muted">
            Elige una de tus campañas. Si no eres su DM, el DM tendrá que aceptar la solicitud.
          </p>
          {campaigns.length === 0 ? (
            <p className="rounded-md bg-surface p-3 text-sm text-muted">
              No estás en ninguna campaña activa de {systemName}.
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
              {campaigns.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-semibold ${c.reason ? "text-muted" : ""}`}>{c.name}</p>
                    {!c.reason && (
                      <p className="text-sm text-muted">{c.isDm ? "Eres el DM: se unirá al momento." : "El DM tendrá que aceptarlo."}</p>
                    )}
                    {c.reason && <p className="mt-1 text-xs text-brand-soft">{c.reason}</p>}
                  </div>
                  <button
                    type="button"
                    disabled={!!c.reason || loading}
                    onClick={() => join(c)}
                    aria-label={`${c.isDm ? "Unir a" : "Solicitar unirse a"} ${c.name}`}
                    className="flex items-center gap-2 rounded-md bg-brand px-3 py-1.5 text-sm font-bold text-white transition-colors enabled:hover:bg-brand-hover disabled:opacity-40"
                  >
                    {picked === c.id && <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />}
                    {c.isDm ? "Unir" : "Solicitar"}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error && <p role="alert" className="mt-4 text-sm text-brand-soft">{error}</p>}
          <div className="mt-5 flex justify-end">
            {/* El foco empieza aquí y no en el primer «Unir», para no enviar nada con un Intro sin querer */}
            <button type="button" data-autofocus onClick={() => setOpener(null)} disabled={loading} className={secondary}>
              Cerrar
            </button>
          </div>
        </CampaignDialog>
      )}
    </>
  );
}

/** «Cancelar solicitud» (pendiente) o «Quitar de la campaña» (aprobado), con confirmación. */
export function LeaveCampaignButton({ characterId, name, campaignName, pending, isDm, onDone }: {
  characterId: string;
  name: string;
  campaignName: string;
  pending: boolean;
  /** Quien mira es el DM de la campaña (no hay a quién avisar). */
  isDm: boolean;
  /** Tras cancelar o quitar (como en JoinCampaignDialog). */
  onDone?: () => void;
}) {
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  const { send, loading } = useCampaignRequest();
  const text = pending
    ? {
        label: "Cancelar solicitud",
        question: `¿Cancelar la solicitud de ${name}?`,
        detail: "El personaje se quedará sin campaña. Podrás volver a solicitarlo.",
        confirm: "Cancelar solicitud",
        done: `Has cancelado la solicitud de ${name}.`,
      }
    : {
        label: "Quitar de la campaña",
        question: `¿Quitar a ${name} de ${campaignName}?`,
        detail: isDm
          ? "El personaje seguirá en «Mis personajes», sin campaña."
          : "El personaje seguirá en «Mis personajes», sin campaña. Se avisará al DM.",
        confirm: "Quitar",
        done: `${name} ya no está en ${campaignName}.`,
      };

  async function run() {
    // Si falla, se cierra y el error sale en el aviso de la cabecera
    const ok = await send(`/api/characters/${characterId}/campaign`, "DELETE", () => text.done);
    setOpener(null);
    if (ok) onDone?.();
  }

  return (
    <>
      <button type="button" onClick={(e) => setOpener(e.currentTarget)} aria-haspopup="dialog" className={smallButton}>
        {text.label}
      </button>
      {opener && (
        <CampaignDialog
          title={text.question}
          opener={opener}
          onClose={() => !loading && setOpener(null)}
          icon={
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand-soft">
              <TriangleAlert size={20} aria-hidden="true" />
            </span>
          }
        >
          <p className="mb-5 text-sm text-muted">{text.detail}</p>
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" onClick={() => setOpener(null)} disabled={loading} className={secondary}>
              Volver
            </button>
            <button type="button" onClick={run} disabled={loading} className={primary}>
              {loading && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
              {text.confirm}
            </button>
          </div>
        </CampaignDialog>
      )}
    </>
  );
}
