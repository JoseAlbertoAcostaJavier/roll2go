"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoaderCircle, WandSparkles, X } from "lucide-react";
import type { CatalogEntry, SpellOption } from "@/lib/rules/catalog";
import { spellClassNames, spellLevelLabel, spellSchoolName } from "@/lib/rules/dnd2024/spellText";
import type { SpellData } from "@/lib/rules/types";
import Bbcode from "@/app/components/Bbcode";
import { SCHOOL_ICONS } from "@/app/components/icons/schools";

// "libro:spell:clave" → referencia (la clave también lleva ":")
const refFromKey = (k: string) => ({ book: k.slice(0, k.indexOf(":")), key: k.slice(k.indexOf(":") + 1) });

type Loaded = { key: string; entry: CatalogEntry | null; error: string };

/** Quita `?spell=` de la dirección (cierra la ficha) sin recargar la página. */
export function closeSpell() {
  const params = new URLSearchParams(window.location.search);
  params.delete("spell");
  window.history.pushState(null, "", `?${params.toString()}`);
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

// Ficha de un conjuro (spec de conjuros §4.1): se abre con `?spell=<libro:clave>` (enlace propio) y pide la
// descripción al servidor. La descripción ya incluye la mejora a niveles superiores, así que no se repite.
export default function SpellDialog({ spells, campaignId }: {
  /** Conjuros ya cargados en la pestaña (para mostrar la cabecera mientras llega la descripción). */
  spells: Map<string, SpellOption>;
  campaignId: string | null;
}) {
  const uid = useId();
  const key = useSearchParams().get("spell");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!key) return;
    let stale = false;
    const ref = refFromKey(key);
    const query = campaignId ? `?campaign=${encodeURIComponent(campaignId)}` : "";
    fetch(`/api/rules/entries/${encodeURIComponent(ref.book)}/${encodeURIComponent(ref.key)}${query}`)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (stale) return;
        if (res.ok && data?.entry) setLoaded({ key, entry: data.entry as CatalogEntry, error: "" });
        else setLoaded({ key, entry: null, error: res.status === 404 ? "Conjuro no disponible." : (data?.error ?? "No se pudo cargar el conjuro.") });
      })
      .catch(() => !stale && setLoaded({ key, entry: null, error: "No se pudo conectar con el servidor." }));
    return () => {
      stale = true;
    };
  }, [key, campaignId]);

  // Foco en el botón de cerrar al abrir; al cerrar vuelve a donde estaba
  useEffect(() => {
    if (!key) return;
    opener.current = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    return () => opener.current?.focus();
  }, [key]);

  if (!key) return null;
  const current = loaded?.key === key ? loaded : null;
  const option = spells.get(key);
  const entry = current?.entry ?? null;
  const data = (entry?.data ?? option?.data ?? null) as SpellData | null;
  const name = entry ? (entry.nameEs ?? entry.name) : option ? (option.nameEs ?? option.name) : "";
  const Icon = data ? SCHOOL_ICONS[data.school] : undefined;
  const attack = data?.tags.filter((t) => t === "Ataque de conjuro" || t.startsWith("Salvación de")).join(", ") ?? "";
  const description = entry ? entry.descriptionEs || entry.description : "";

  // Escape cierra y Tab no sale de la ventana
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeSpell();
    } else if (e.key === "Tab" && box.current) {
      const items = [...box.current.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]")];
      const [first, last] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && closeSpell()}
    >
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        aria-busy={!current}
        onKeyDown={onKeyDown}
        className="max-h-full w-full max-w-2xl animate-pop overflow-y-auto rounded-xl border border-line bg-panel p-5 shadow-[0_12px_40px_rgba(0,0,0,0.6)] sm:p-6"
      >
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-surface text-brand-soft">
            {Icon ? <Icon size={28} /> : <WandSparkles size={24} aria-hidden="true" />}
          </span>
          <div className="min-w-0 flex-1">
            <h3 id={`${uid}-title`} className="font-heading text-2xl font-bold">{name || "Conjuro"}</h3>
            {data && (
              <p className="text-sm text-muted">
                {spellLevelLabel(data.level)} · {spellSchoolName(data.school)}
                {data.ritual && " · Ritual"}
                {(entry?.bookName ?? option?.bookName) && <> · {entry?.bookName ?? option?.bookName}</>}
              </p>
            )}
          </div>
          <button
            ref={closeButton}
            type="button"
            onClick={closeSpell}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface hover:text-white"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {data && (
          <dl className="mb-4 grid grid-cols-1 gap-3 rounded-md border border-line bg-surface p-3 sm:grid-cols-2">
            <Field label="Tiempo de lanzamiento" value={data.time} />
            <Field label="Alcance" value={data.range} />
            <Field label="Componentes" value={data.components} />
            <Field label="Duración" value={data.duration} />
            <Field label="Ataque o salvación" value={attack} />
            <Field label="Clases" value={spellClassNames(data.classes).join(", ")} />
          </dl>
        )}

        {!current ? (
          <p className="flex items-center gap-2 text-sm text-muted" role="status">
            <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> Cargando…
          </p>
        ) : current.error ? (
          <p className="text-sm text-brand-soft" role="alert">{current.error}</p>
        ) : description ? (
          <Bbcode source={description} className="text-sm" />
        ) : (
          <p className="text-sm text-muted">Sin descripción.</p>
        )}
      </div>
    </div>
  );
}
