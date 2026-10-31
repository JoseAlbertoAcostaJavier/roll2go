"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, EllipsisVertical, LoaderCircle, TriangleAlert, X } from "lucide-react";
import useDismiss from "@/app/components/ui/useDismiss";

/* Acciones sobre los personajes de la campaña (spec §8.1): menú «⋮», botones Aceptar/Denegar del DM y el aviso de
   resultado. El aviso vive en la sección y no en la tarjeta, porque al quitar un personaje su tarjeta desaparece. */

type Notice = { kind: "ok" | "error"; text: string } | null;
const NoticeContext = createContext<{ notice: Notice; setNotice: (n: Notice) => void }>({ notice: null, setNotice: () => {} });

/** Envuelve la sección Personajes: guarda el mensaje de la última acción, que pinta `CharacterNoticeArea`. */
export function CharacterNotices({ children }: { children: React.ReactNode }) {
  const [notice, setNotice] = useState<Notice>(null);
  return <NoticeContext.Provider value={{ notice, setNotice }}>{children}</NoticeContext.Provider>;
}

/** Mensaje de éxito o error del servidor de la última acción. */
export function CharacterNoticeArea() {
  const { notice } = useContext(NoticeContext);
  // Las dos regiones existen siempre para que los lectores de pantalla anuncien el texto al cambiar
  return (
    <>
      <p role="status" className={notice?.kind === "ok" ? "mb-4 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm" : "sr-only"}>
        {notice?.kind === "ok" ? notice.text : ""}
      </p>
      <p role="alert" className={notice?.kind === "error" ? "mb-4 rounded-md border border-brand/40 bg-brand/10 px-3 py-2 text-sm text-brand-soft" : "sr-only"}>
        {notice?.kind === "error" ? notice.text : ""}
      </p>
    </>
  );
}

/**
 * Llama a una ruta de la campaña; si va bien, refresca la página y muestra `success`. Devuelve si fue bien. Con
 * `inlineErrors`, el error no sale en la sección sino en `error` (para pintarlo dentro de una ventana abierta).
 */
export function useCampaignRequest({ inlineErrors = false } = {}) {
  const router = useRouter();
  const { setNotice } = useContext(NoticeContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const send = useCallback(
    async (url: string, method: "POST" | "DELETE", success: (data: Record<string, unknown>) => string, body?: unknown) => {
      setLoading(true);
      setNotice(null);
      setError("");
      const fail = (text: string) => (inlineErrors ? setError(text) : setNotice({ kind: "error", text }));
      try {
        const res = await fetch(url, {
          method,
          headers: body ? { "Content-Type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          fail(data?.error ?? `El servidor ha respondido con un error (${res.status}).`);
          return false;
        }
        setNotice({ kind: "ok", text: success(data ?? {}) });
        router.refresh();
        return true;
      } catch {
        fail("No se pudo conectar con el servidor.");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [router, setNotice, inlineErrors],
  );
  return { send, loading, error, clearError: () => setError("") };
}

/**
 * Ventana modal de la sección, con el comportamiento de StatDialog: foco dentro al abrir, atrapado con Tab, Escape
 * cierra y el foco vuelve a `opener`. Se pinta en <body>: dentro de un ancestro animado (p. ej. la cabecera de la
 * ficha, con transform) `fixed` quedaría encerrado en él.
 */
export function CampaignDialog({ title, icon, onClose, opener, children }: {
  title: string;
  icon?: React.ReactNode;
  onClose: () => void;
  /** Botón que abrió la ventana; recibe el foco al cerrar. */
  opener: HTMLElement | null;
  children: React.ReactNode;
}) {
  const uid = useId();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // El marcado con data-autofocus o, si no hay, el primer botón
    const first = box.current?.querySelector<HTMLElement>("[data-autofocus]") ?? box.current?.querySelector<HTMLElement>("button:not(:disabled)");
    first?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, [opener]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Tab" && box.current) {
      const items = [...box.current.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]")];
      // Sin nada enfocable (p. ej. todos los botones desactivados mientras se envía), el foco no sale de la ventana
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const [first, last] = [items[0], items[items.length - 1]];
      if (document.activeElement === box.current) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/70 p-4 backdrop-blur-sm print:hidden"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="max-h-full w-full max-w-lg animate-pop overflow-y-auto rounded-xl border border-line bg-panel p-5 shadow-[0_12px_40px_rgba(0,0,0,0.6)] outline-none sm:p-6"
      >
        <div className="mb-4 flex items-center gap-3">
          {icon}
          <h3 id={`${uid}-title`} className="min-w-0 flex-1 break-words font-heading text-xl font-bold">{title}</h3>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

const secondary =
  "rounded-md border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors enabled:hover:text-white disabled:opacity-50";
const primary =
  "flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-bold text-white transition-colors enabled:hover:bg-brand-hover disabled:opacity-50";

type Action = { label: string; question: string; detail: string; confirm: string; url: string; done: string };

/**
 * Menú «⋮» de una tarjeta. El DM quita cualquier personaje; el dueño saca el suyo o cancela su solicitud. Cada
 * opción pide confirmación con el nombre del personaje.
 */
export function CharacterMenu({ campaignId, characterId, name, isDm, isOwn, pending }: {
  campaignId: string;
  characterId: string;
  name: string;
  /** Quien mira es el DM (si no, es el dueño: la página no pinta el menú para el resto). */
  isDm: boolean;
  /** El personaje es de quien mira. */
  isOwn: boolean;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Acción por confirmar y el botón «⋮», que recupera el foco al cerrar la confirmación
  const [asking, setAsking] = useState<(Action & { opener: HTMLElement | null }) | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const { send, loading } = useCampaignRequest();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  // Al abrir, el foco va a la primera opción
  useEffect(() => {
    if (open) menu.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
  }, [open]);

  const action: Action = isDm
    ? {
        label: "Quitar de la campaña",
        question: `¿Quitar a ${name} de la campaña?`,
        detail: isOwn
          ? "El personaje seguirá en «Mis personajes», sin campaña."
          : "El personaje seguirá existiendo para su jugador, que recibirá una notificación.",
        confirm: "Quitar",
        url: `/api/campaigns/${campaignId}/characters/${characterId}`,
        done: `${name} ya no está en la campaña.`,
      }
    : pending
      ? {
          label: "Cancelar solicitud",
          question: `¿Cancelar la solicitud de ${name}?`,
          detail: "El personaje se quedará sin campaña. Podrás volver a solicitarlo.",
          confirm: "Cancelar solicitud",
          url: `/api/characters/${characterId}/campaign`,
          done: `Has cancelado la solicitud de ${name}.`,
        }
      : {
          label: "Quitar de la campaña",
          question: `¿Quitar a ${name} de la campaña?`,
          detail: "El personaje seguirá en «Mis personajes», sin campaña. Se avisará al DM.",
          confirm: "Quitar",
          url: `/api/characters/${characterId}/campaign`,
          done: `${name} ya no está en la campaña.`,
        };

  async function run() {
    if (!asking) return;
    // Si va bien, la tarjeta desaparece al refrescar; si falla, se cierra y el error sale arriba de la lista
    await send(asking.url, "DELETE", () => asking.done);
    setAsking(null);
  }

  return (
    <div ref={ref} className="relative">
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Opciones de ${name}`}
        className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface hover:text-white"
      >
        <EllipsisVertical size={18} aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={menu}
          role="menu"
          onKeyDown={(e) => {
            if (e.key === "Escape") button.current?.focus();
          }}
          className="absolute right-0 top-full z-30 mt-1 w-56 animate-pop overflow-hidden rounded-lg border border-line bg-panel shadow-[0_12px_30px_rgba(0,0,0,0.6)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setAsking({ ...action, opener: button.current });
            }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-200 transition-colors hover:bg-line hover:text-white focus-visible:bg-line focus-visible:outline-none"
          >
            {action.label}
          </button>
        </div>
      )}

      {asking && (
        <CampaignDialog
          title={asking.question}
          opener={asking.opener}
          onClose={() => !loading && setAsking(null)}
          icon={
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand-soft">
              <TriangleAlert size={20} aria-hidden="true" />
            </span>
          }
        >
          <p className="mb-5 text-sm text-muted">{asking.detail}</p>
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" onClick={() => setAsking(null)} disabled={loading} className={secondary}>
              Volver
            </button>
            <button type="button" onClick={run} disabled={loading} className={primary}>
              {loading && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
              {asking.confirm}
            </button>
          </div>
        </CampaignDialog>
      )}
    </div>
  );
}

/** Botones del DM sobre una solicitud pendiente: ✓ Aceptar (verde) y ✕ Denegar (rojo). */
export function ReviewButtons({ campaignId, characterId, name }: { campaignId: string; characterId: string; name: string }) {
  const { send, loading } = useCampaignRequest();
  const base = `/api/campaigns/${campaignId}/characters/${characterId}`;
  const round =
    "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors disabled:opacity-50";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={loading}
        onClick={() => send(`${base}/approve`, "POST", () => `Has aceptado a ${name} en la campaña.`)}
        aria-label={`Aceptar a ${name}`}
        title="Aceptar"
        className={`${round} border-success text-success enabled:hover:bg-success enabled:hover:text-black`}
      >
        <Check size={18} aria-hidden="true" />
      </button>
      <button
        type="button"
        disabled={loading}
        onClick={() => send(`${base}/reject`, "POST", () => `Has denegado a ${name}.`)}
        aria-label={`Denegar a ${name}`}
        title="Denegar"
        className={`${round} border-brand text-brand-soft enabled:hover:bg-brand enabled:hover:text-white`}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
