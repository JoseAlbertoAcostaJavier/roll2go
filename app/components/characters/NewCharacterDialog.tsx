"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { BookOption } from "@/lib/rules/books";
import { field, labelClass, primaryButton } from "@/app/components/formStyles";

type Props = {
  systems: { id: string; name: string; creator: boolean }[];
  campaigns: { id: string; name: string; systemId: string; restrictBooks: boolean }[];
  books: BookOption[];
};

/* "Preparar nuevo personaje": elige juego y campaña (opcional) y, si la campaña no filtra ya los libros,
   los libros de reglas. Al continuar lleva al creador con esos datos en la dirección. */
export default function NewCharacterDialog({ systems, campaigns, books }: Props) {
  const router = useRouter();
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [systemId, setSystemId] = useState(systems.find((s) => s.creator)?.id ?? "");
  const [campaignId, setCampaignId] = useState("");
  const [filter, setFilter] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const systemRef = useRef<HTMLSelectElement>(null);

  const systemCampaigns = useMemo(() => campaigns.filter((c) => c.systemId === systemId), [campaigns, systemId]);
  const systemBooks = useMemo(() => books.filter((b) => b.systemId === systemId), [books, systemId]);
  const campaignRestricts = systemCampaigns.find((c) => c.id === campaignId)?.restrictBooks ?? false;

  // Foco inicial en el primer campo y cierre con Escape
  useEffect(() => {
    if (!open) return;
    systemRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function changeSystem(id: string) {
    setSystemId(id);
    setCampaignId("");
    setPicked([]);
  }

  function toggleBook(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams({ system: systemId });
    if (campaignId) params.set("campaign", campaignId);
    if (!campaignRestricts && filter && picked.length > 0) params.set("books", picked.join(","));
    router.push(`/characters/new?${params.toString()}`);
  }

  const secondary =
    "rounded-md border border-line px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:text-white";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md bg-brand px-4 py-2 font-heading text-sm font-bold text-white transition-colors hover:bg-brand-hover"
      >
        <Plus size={16} aria-hidden="true" /> Añadir
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${uid}-title`}
            onSubmit={submit}
            className="max-h-full w-full max-w-lg animate-pop overflow-y-auto rounded-xl border border-line bg-panel p-6 shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
          >
            <h3 id={`${uid}-title`} className="mb-5 font-heading text-xl font-bold">
              Preparar nuevo personaje
            </h3>

            <div className="mb-4">
              <label htmlFor={`${uid}-system`} className={labelClass}>Juego</label>
              <select
                id={`${uid}-system`}
                ref={systemRef}
                value={systemId}
                onChange={(e) => changeSystem(e.target.value)}
                className={field}
              >
                {systems.map((s) => (
                  <option key={s.id} value={s.id} disabled={!s.creator}>
                    {s.name}{s.creator ? "" : " (Próximamente)"}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label htmlFor={`${uid}-campaign`} className={labelClass}>Campaña</label>
              <select
                id={`${uid}-campaign`}
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                className={field}
              >
                <option value="">-</option>
                {systemCampaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <p className="mb-4 rounded-md border border-line bg-surface p-3 text-sm text-muted">
              Puedes determinar el contenido disponible para un personaje{" "}
              <strong className="text-white">si lo asignas a una campaña</strong> o si añades un{" "}
              <strong className="text-white">filtro por libros de reglas</strong>. Si el filtro por libros de reglas
              está activo en la campaña o en el personaje,{" "}
              <strong className="text-white">solo se usará el contenido habilitado</strong>, ignorando el resto.
            </p>

            <label className="mb-1 flex cursor-pointer items-start gap-3 text-sm has-disabled:cursor-not-allowed has-disabled:opacity-60">
              <input
                type="checkbox"
                checked={filter && !campaignRestricts}
                disabled={campaignRestricts}
                onChange={(e) => setFilter(e.target.checked)}
                className="mt-1 h-4 w-4 accent-brand"
              />
              <span>
                <span className="block font-semibold">Filtrar contenido por libros de reglas</span>
                <span className="block text-muted">
                  {campaignRestricts
                    ? "La campaña elegida ya filtra los libros de reglas; se usará su selección."
                    : "Opcional. El filtro de campaña tiene prioridad sobre esta selección."}
                </span>
              </span>
            </label>

            {filter && !campaignRestricts && (
              <fieldset className="mt-3 max-h-48 space-y-2 overflow-y-auto rounded-md border border-line bg-surface p-3">
                <legend className="px-1 text-sm font-semibold">Libros de reglas</legend>
                {systemBooks.length === 0 ? (
                  <p className="text-sm text-muted">No hay libros disponibles para este juego.</p>
                ) : (
                  systemBooks.map((b) => (
                    <label key={b.id} className="flex cursor-pointer items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={picked.includes(b.id)}
                        onChange={() => toggleBook(b.id)}
                        className="h-4 w-4 accent-brand"
                      />
                      {b.name}
                    </label>
                  ))
                )}
              </fieldset>
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setOpen(false)} className={secondary}>Cancelar</button>
              <button type="submit" disabled={!systemId} className={primaryButton}>Continuar</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
