"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronsUp, CircleCheck, Pencil, Printer, User as UserIcon, X } from "lucide-react";
import DeleteLevel from "../levelup/DeleteLevel";
import StatusBadge, { type CharacterStatus } from "./StatusBadge";
import RestButtons from "./RestButtons";
import type { HitDicePool } from "@/lib/rules/dnd2024/sheet/rest";
import JoinCampaignDialog, { LeaveCampaignButton, type JoinableCampaign } from "./JoinCampaignDialog";
import { CharacterNoticeArea, CharacterNotices } from "@/app/components/campaigns/CharacterActions";

// Nivel total máximo (como MAX_LEVEL del servidor)
const MAX_LEVEL = 20;
const secondaryButton =
  "flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-semibold transition-colors hover:border-brand hover:text-white";

export type SheetHeaderProps = {
  id: string;
  name: string;
  /** «Él/Elle»; vacío si no los indica. */
  pronouns: string;
  portraitUrl: string | null;
  status: CharacterStatus;
  /** «Especie (Legado) Clase N / Clase M». */
  summary: string;
  level: number;
  /** Campaña del personaje; `pending` mientras el DM no acepte la solicitud, `isDm` si quien mira es su DM. */
  campaign: { id: string; name: string; pending: boolean; isDm: boolean } | null;
  isOwner: boolean;
  /** Dados de golpe por clase y modificador de Constitución (para el diálogo del descanso corto). */
  pools: HitDicePool[];
  conMod: number;
  /** Si un descanso corto recuperaría algo más ahora (espacios de pacto, usos): para el aviso del diálogo. */
  recoversOther: boolean;
  /** Para el dueño sin campaña: sus campañas activas del sistema del personaje, con su elegibilidad. */
  joinable: JoinableCampaign[];
  systemName: string;
  /** Aviso tras volver de una acción (`?saved=…`). */
  notice: string | null;
  backHref: string;
};

export default function SheetHeader(p: SheetHeaderProps) {
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
    /* La animación crea un contexto de apilado propio: mientras se ve el tooltip del estado, la cabecera sube por encima
       de las características, que van después */
    <header className="relative mb-6 animate-fade-up has-[[aria-describedby=status-tip]:hover]:z-40 has-[[aria-describedby=status-tip]:focus-visible]:z-40">
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

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="relative shrink-0">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-md border border-line bg-surface text-muted">
                {p.portraitUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.portraitUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UserIcon size={36} aria-hidden="true" />
                )}
              </div>
              <StatusBadge status={p.status} isOwner={p.isOwner} />
            </div>
            <div className="min-w-0">
              <h1 className="break-words font-heading text-3xl font-extrabold">
                {p.name}
                {p.pronouns && <span className="ml-2 align-middle font-body text-base font-normal text-muted">({p.pronouns})</span>}
              </h1>
              {p.summary && <p className="text-muted">{p.summary}</p>}
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
                <span className="rounded bg-surface px-2 py-0.5 font-heading font-bold">Nivel {p.level}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {p.isOwner && <RestButtons characterId={p.id} pools={p.pools} conMod={p.conMod} recoversOther={p.recoversOther} />}
            {p.isOwner && p.level < MAX_LEVEL && (
              <Link
                href={`/characters/${p.id}/level-up`}
                className="flex items-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
              >
                <ChevronsUp size={16} aria-hidden="true" /> Subir de nivel
              </Link>
            )}
            {p.isOwner && p.level >= 2 && (
              <DeleteLevel characterId={p.id} level={p.level} redirectTo={`/characters/${p.id}?saved=level-deleted`} />
            )}
            {p.isOwner && (
              <Link href={`/characters/${p.id}/edit`} className={secondaryButton}>
                <Pencil size={16} aria-hidden="true" /> Editar
              </Link>
            )}
            {p.isOwner && (
              <button type="button" onClick={() => window.print()} className={secondaryButton}>
                <Printer size={16} aria-hidden="true" /> Imprimir
              </button>
            )}
            <Link href={p.backHref} className="flex items-center gap-1 px-2 py-2 text-sm text-muted hover:text-white">
              <ChevronLeft size={16} aria-hidden="true" /> Volver
            </Link>
          </div>
        </div>
      </CharacterNotices>
    </header>
  );
}
