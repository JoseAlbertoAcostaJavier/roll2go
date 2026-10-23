"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, CircleCheck, Pencil, Printer, User as UserIcon, X } from "lucide-react";
import StatusBadge, { type CharacterStatus } from "./StatusBadge";

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
  campaign: { id: string; name: string } | null;
  isOwner: boolean;
  /** Aviso tras volver de una acción (`?saved=1`). */
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

  // Al descartar el aviso se quita también de la dirección, para que no vuelva al recargar
  const dismiss = () => {
    setNotice(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("saved");
    window.history.replaceState(null, "", url);
  };

  return (
    <header className="mb-6 animate-fade-up">
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
            <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm">
              {p.campaign ? (
                <Link href={`/campaigns/${p.campaign.id}`} className="text-brand-soft hover:underline">
                  {p.campaign.name}
                </Link>
              ) : (
                <span className="text-muted">Sin campaña</span>
              )}
              <span className="rounded bg-surface px-2 py-0.5 font-heading font-bold">Nivel {p.level}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {/* «Subir de nivel» (solo dueño, oculto a nivel 20) vuelve con la página /characters/[id]/level-up, en el
              plan de la parte 4 (spec §3.2); hasta entonces no se muestra para no enlazar a un 404 */}
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
    </header>
  );
}
