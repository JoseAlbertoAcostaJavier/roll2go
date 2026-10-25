"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { useSearchParams } from "next/navigation";
import { LoaderCircle, X } from "lucide-react";
import type { CatalogEntry, SpellOption } from "@/lib/rules/catalog/types";
import { spellLevelLabel, spellSchoolName } from "@/lib/rules/dnd2024/spells/spellTextClient";
import type { SpellData } from "@/lib/rules/types";
import Bbcode from "@/app/components/ui/Bbcode";
import RoundIcon from "@/app/components/ui/RoundIcon";

// "libro:spell:clave" → referencia (la clave también lleva ":")
const refFromKey = (k: string) => ({ book: k.slice(0, k.indexOf(":")), key: k.slice(k.indexOf(":") + 1) });

// `classNames`: las clases del conjuro en español (las traduce el servidor, que tiene `es.json`)
type Loaded = { key: string; entry: CatalogEntry | null; classNames: string[]; error: string };

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
// descripción al servidor, dentro de los libros del personaje (sin personaje, en el creador, los libros que puede usar
// el usuario en la campaña). La descripción ya incluye la mejora a niveles superiores, así que no se repite.
export default function SpellDialog({ characterId, campaignId = null, spells, opener }: {
  characterId: string | null;
  /** Sin personaje: campaña cuyos libros se usan. */
  campaignId?: string | null;
  /** Conjuros ya cargados en la pestaña (para mostrar la cabecera mientras llega la descripción). */
  spells: Map<string, SpellOption>;
  /** Elemento que abrió la ficha (lo fija quien la abre); recibe el foco al cerrar. Con el enlace directo, ninguno. */
  opener: RefObject<HTMLElement | null>;
}) {
  const uid = useId();
  const key = useSearchParams().get("spell");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!key) return;
    let stale = false;
    const ref = refFromKey(key);
    const path = `${encodeURIComponent(ref.book)}/${encodeURIComponent(ref.key)}`;
    const url = characterId
      ? `/api/characters/${characterId}/spells/${path}`
      : `/api/rules/entries/${path}${campaignId ? `?campaign=${encodeURIComponent(campaignId)}` : ""}`;
    fetch(url)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (stale) return;
        if (res.ok && data?.entry) {
          setLoaded({ key, entry: data.entry as CatalogEntry, classNames: (data.classNames as string[] | undefined) ?? [], error: "" });
        } else setLoaded({ key, entry: null, classNames: [], error: res.status === 404 ? "Conjuro no disponible." : (data?.error ?? "No se pudo cargar el conjuro.") });
      })
      .catch(() => !stale && setLoaded({ key, entry: null, classNames: [], error: "No se pudo conectar con el servidor." }));
    return () => {
      stale = true;
    };
  }, [key, characterId, campaignId]);

  // Foco en el botón de cerrar al abrir; al cerrar vuelve a quien la abrió (no se usa document.activeElement: Safari
  // no enfoca los enlaces al pulsarlos)
  useEffect(() => {
    if (!key) return;
    closeButton.current?.focus();
    return () => {
      const el = opener.current;
      opener.current = null;
      if (el?.isConnected) el.focus();
    };
  }, [key, opener]);

  if (!key) return null;
  const current = loaded?.key === key ? loaded : null;
  const option = spells.get(key);
  const entry = current?.entry ?? null;
  const data = (entry?.data ?? option?.data ?? null) as SpellData | null;
  const name = entry ? (entry.nameEs ?? entry.name) : option ? (option.nameEs ?? option.name) : "";
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
      // Con el foco en la propia ventana (tras pulsar en su texto), Tab va al primero y Mayús+Tab al último
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
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="max-h-full w-full max-w-2xl animate-pop outline-none overflow-y-auto rounded-xl border border-line bg-panel p-5 shadow-[0_12px_40px_rgba(0,0,0,0.6)] sm:p-6"
      >
        <div className="mb-4 flex items-start gap-3">
          <RoundIcon kind="school" id={data?.school} label={name || "Conjuro"} size={48} />
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
            <Field label="Clases" value={current?.classNames.join(", ") ?? ""} />
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
