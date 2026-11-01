"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BedDouble, Coffee, LoaderCircle } from "lucide-react";
import { CampaignDialog } from "@/app/components/campaigns/CharacterActions";

type Rest = "short" | "long";

const button =
  "flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-semibold transition-colors hover:border-brand hover:text-white";
const secondary =
  "rounded-md border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors enabled:hover:text-white disabled:opacity-50";
const primary =
  "flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-bold text-white transition-colors enabled:hover:bg-brand-hover disabled:opacity-50";

const TEXT: Record<Rest, { title: string; question: string }> = {
  long: {
    title: "Descanso largo",
    question: "¿Hacer un descanso largo? Recuperas todos los puntos de golpe y los espacios de conjuro.",
  },
  short: {
    title: "Descanso corto",
    question: "¿Hacer un descanso corto? Recuperas los espacios y usos que se recuperan con un descanso corto.",
  },
};
const NOTHING = "No tienes nada que se recupere con un descanso corto.";

/** Botones «Descanso corto» y «Descanso largo» de la cabecera (solo el dueño). Cada uno pide confirmación; el
 *  descanso lo aplica la ruta de conjuros y la página se refresca con la hoja recuperada. */
export default function RestButtons({ characterId, shortRestRestores }: { characterId: string; shortRestRestores: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<{ rest: Rest; opener: HTMLElement } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const show = (rest: Rest) => (e: React.MouseEvent<HTMLButtonElement>) => {
    setError("");
    setOpen({ rest, opener: e.currentTarget });
  };

  async function confirm(rest: Rest) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/characters/${characterId}/spells`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: rest === "long" ? "longRest" : "shortRest" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? `El servidor ha respondido con un error (${res.status}).`);
        return;
      }
      setOpen(null);
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  const rest = open?.rest;
  const nothing = rest === "short" && !shortRestRestores;

  return (
    <>
      <button type="button" onClick={show("short")} aria-haspopup="dialog" className={button}>
        <Coffee size={16} aria-hidden="true" /> Descanso corto
      </button>
      <button type="button" onClick={show("long")} aria-haspopup="dialog" className={button}>
        <BedDouble size={16} aria-hidden="true" /> Descanso largo
      </button>

      {open && rest && (
        <CampaignDialog title={TEXT[rest].title} opener={open.opener} onClose={() => !loading && setOpen(null)}>
          <p className="mb-5 text-sm text-muted">{nothing ? NOTHING : TEXT[rest].question}</p>
          {error && <p role="alert" className="mb-4 text-sm text-brand-soft">{error}</p>}
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" data-autofocus onClick={() => setOpen(null)} disabled={loading} className={secondary}>
              {nothing ? "Cerrar" : "Cancelar"}
            </button>
            {!nothing && (
              <button type="button" onClick={() => confirm(rest)} disabled={loading} className={primary}>
                {loading && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
                {TEXT[rest].title}
              </button>
            )}
          </div>
        </CampaignDialog>
      )}
    </>
  );
}
