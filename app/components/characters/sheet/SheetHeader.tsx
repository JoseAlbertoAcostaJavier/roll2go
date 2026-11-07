"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronsUp, CircleCheck, Pencil, Printer, User as UserIcon, X } from "lucide-react";
import DeleteLevel from "../levelup/DeleteLevel";
import StatusBadge, { type CharacterStatus } from "./StatusBadge";
import InspirationBox from "./InspirationBox";
import { fmtMod } from "@/lib/rules/dnd2024/sheet/labels";
import { sheetBox } from "./statUi";
import type { ShowStat } from "./types";
import JoinCampaignDialog, { LeaveCampaignButton, type JoinableCampaign } from "./JoinCampaignDialog";
import { CharacterNoticeArea, CharacterNotices } from "@/app/components/campaigns/CharacterActions";

// Nivel total máximo (como MAX_LEVEL del servidor)
const MAX_LEVEL = 20;
const iconButton =
  "rounded p-1.5 text-muted transition-colors hover:bg-surface hover:text-white focus-visible:outline-2 focus-visible:outline-brand";

export type SheetHeaderProps = {
  id: string;
  name: string;
  /** «Él/Elle»; vacío si no los indica. */
  pronouns: string;
  portraitUrl: string | null;
  status: CharacterStatus;
  /** «Clase N / Clase M». */
  classes: string;
  /** «Especie (Legado)». */
  species: string;
  background: string;
  xp: number;
  level: number;
  /** Campaña del personaje; `pending` mientras el DM no acepte la solicitud, `isDm` si quien mira es su DM. */
  campaign: { id: string; name: string; pending: boolean; isDm: boolean } | null;
  isOwner: boolean;
  /** Para el dueño sin campaña: sus campañas activas del sistema del personaje, con su elegibilidad. */
  joinable: JoinableCampaign[];
  systemName: string;
  /** Aviso tras volver de una acción (`?saved=…`). */
  notice: string | null;
  backHref: string;
};

export default function SheetHeader(p: SheetHeaderProps & {
  initiative: number;
  proficiencyBonus: number;
  /** Inspiración heroica guardada. */
  inspiration: boolean;
  show: ShowStat;
}) {
  const [notice, setNotice] = useState(p.notice);

  // Al imprimir (botón o Ctrl+P) se despliegan todos los rasgos plegados; al terminar se vuelven a plegar
  useEffect(() => {
    let closed: HTMLDetailsElement[] = [];
    const openAll = () => {
      closed = [...document.querySelectorAll<HTMLDetailsElement>("main details:not([open])")];
      closed.forEach((d) => (d.open = true));
    };
    const restore = () => {
      closed.forEach((d) => (d.open = false));
      closed = [];
    };
    window.addEventListener("beforeprint", openAll);
    window.addEventListener("afterprint", restore);
    return () => {
      window.removeEventListener("beforeprint", openAll);
      window.removeEventListener("afterprint", restore);
    };
  }, []);

  // Tras unir, cancelar o quitar, la página se refresca y el botón que abrió la ventana ya no existe: el foco pasa al
  // botón nuevo de la campaña (y no se pierde en <body>)
  const campaignControls = useRef<HTMLSpanElement>(null);
  const refocus = useRef(false);
  const campaignState = p.campaign ? `${p.campaign.id}:${p.campaign.pending}` : "";
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    campaignControls.current?.querySelector<HTMLElement>("button")?.focus();
  }, [campaignState]);
  const onCampaignChange = () => {
    refocus.current = true;
  };

  // Al descartar el aviso se quita también de la dirección, para que no vuelva al recargar
  const dismiss = () => {
    setNotice(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("saved");
    window.history.replaceState(null, "", url);
  };

  return (
    <header className={`${sheetBox} p-4`}>
      <CharacterNotices>
        {/* Resultado de unir, cancelar o quitar de una campaña */}
        <div className="print:hidden">
          <CharacterNoticeArea />
        </div>
        {notice && (
          <p role="status" className="mb-4 flex items-center gap-2 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success print:hidden">
            <CircleCheck size={16} aria-hidden="true" className="shrink-0" />
            <span className="flex-1">{notice}</span>
            <button type="button" onClick={dismiss} aria-label="Cerrar aviso" className="rounded p-1 hover:text-white">
              <X size={16} aria-hidden="true" />
            </button>
          </p>
        )}

        <div className="flex gap-4">
          {/* Retrato, con el nivel en un rombo y el estado encima */}
          <div className="flex w-28 shrink-0 flex-col gap-5">
            <div className="relative">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-lg border-2 border-brand bg-surface text-muted">
                {p.portraitUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.portraitUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UserIcon size={40} aria-hidden="true" />
                )}
              </div>
              <span className="absolute -bottom-3.5 left-1/2 flex h-8 w-8 -translate-x-1/2 rotate-45 items-center justify-center rounded-sm bg-brand">
                <span className="-rotate-45 font-heading text-sm font-extrabold text-white">
                  <span className="sr-only">Nivel </span>{p.level}
                </span>
              </span>
              <StatusBadge status={p.status} isOwner={p.isOwner} />
            </div>
            {p.isOwner && p.level < MAX_LEVEL && (
              <Link
                href={`/characters/${p.id}/level-up`}
                className="flex items-center justify-center gap-1 rounded-md border border-line-strong px-1 py-2 font-heading text-xs font-bold text-white transition-colors hover:border-brand hover:bg-brand/15 print:hidden"
              >
                <ChevronsUp size={14} aria-hidden="true" /> Subir nivel
              </Link>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-2">
              <h1 className="min-w-0 break-words font-heading text-xl font-extrabold uppercase leading-tight text-brand-soft">
                {p.name}
                {p.pronouns && <span className="ml-2 align-middle font-body text-xs font-semibold normal-case text-fg">{p.pronouns}</span>}
              </h1>
              {p.isOwner && (
                <div className="flex shrink-0 items-center print:hidden">
                  <button type="button" onClick={() => window.print()} aria-label="Imprimir" title="Imprimir" className={iconButton}>
                    <Printer size={16} aria-hidden="true" />
                  </button>
                  <Link href={`/characters/${p.id}/edit`} aria-label="Editar" title="Editar" className={iconButton}>
                    <Pencil size={16} aria-hidden="true" />
                  </Link>
                </div>
              )}
            </div>
            <div className="mt-1 space-y-0.5 text-sm text-fg">
              {p.classes && <p>{p.classes}</p>}
              {p.species && <p>{p.species}</p>}
              {p.background && <p>{p.background}</p>}
              <p className="text-muted">Experiencia: {p.xp.toLocaleString("es-ES")}</p>
              <p className="text-muted">
                Bonificador de competencia <span className="ml-1 rounded bg-surface px-1.5 text-xs font-bold text-fg">{fmtMod(p.proficiencyBonus)}</span>
              </p>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {p.campaign ? (
                p.campaign.pending ? (
                  <span className="text-muted">
                    Pendiente de aprobación en{" "}
                    <Link href={`/campaigns/${p.campaign.id}`} className="text-brand-soft hover:underline">
                      {p.campaign.name}
                    </Link>
                  </span>
                ) : (
                  <Link href={`/campaigns/${p.campaign.id}`} className="text-brand-soft hover:underline">
                    {p.campaign.name}
                  </Link>
                )
              ) : (
                <span className="text-muted">Sin campaña</span>
              )}
              {p.isOwner && (
                <span ref={campaignControls} className="print:hidden">
                  {p.campaign ? (
                    <LeaveCampaignButton
                      characterId={p.id}
                      name={p.name}
                      campaignName={p.campaign.name}
                      pending={p.campaign.pending}
                      isDm={p.campaign.isDm}
                      onDone={onCampaignChange}
                    />
                  ) : (
                    <JoinCampaignDialog
                      characterId={p.id}
                      name={p.name}
                      campaigns={p.joinable}
                      systemName={p.systemName}
                      onDone={onCampaignChange}
                    />
                  )}
                </span>
              )}
            </div>
            <div className="mt-auto flex flex-wrap items-end justify-end gap-2 pt-3">
              <InspirationBox characterId={p.id} initial={p.inspiration} isOwner={p.isOwner} className="min-w-36 flex-1 sm:flex-none" />
              <button
                type="button"
                aria-haspopup="dialog"
                data-print="text"
                onClick={p.show({ kind: "initiative" })}
                className="h-10 min-w-36 flex-1 rounded-md bg-brand px-3 font-heading text-sm font-bold uppercase text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-soft sm:flex-none"
              >
                Iniciativa {fmtMod(p.initiative)}
              </button>
            </div>
          </div>
        </div>
        {p.isOwner && p.level >= 2 && (
          <div className="mt-3 border-t border-line pt-3 print:hidden">
            <DeleteLevel characterId={p.id} level={p.level} redirectTo={`/characters/${p.id}?saved=level-deleted`} />
          </div>
        )}
      </CharacterNotices>
    </header>
  );
}
