"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Trash2, TriangleAlert } from "lucide-react";

/* Zona de peligro: borrar la campaña exige escribir su nombre exacto en un cuadro de confirmación. */
export default function DeleteCampaign({
  campaignId,
  campaignName,
}: {
  campaignId: string;
  campaignName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = typed.trim() === campaignName.trim();

  function close() {
    if (loading) return;
    setOpen(false);
    setTyped("");
    setError("");
  }

  // Con el cuadro abierto: foco en el campo y la tecla Escape lo cierra
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        setOpen(false);
        setTyped("");
        setError("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading]);

  async function confirmDelete() {
    if (!matches || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName: typed.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? `El servidor ha respondido con un error (${res.status}).`);
        return;
      }
      router.push("/campaigns");
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-max items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-brand-hover"
      >
        <Trash2 size={14} aria-hidden="true" /> Borrar campaña
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            className="w-full max-w-md rounded-xl border border-line bg-panel p-6 shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
          >
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand-soft">
                <TriangleAlert size={20} aria-hidden="true" />
              </span>
              <h3 id="delete-title" className="font-heading text-xl font-bold">
                ¿Borrar la campaña?
              </h3>
            </div>

            <ul className="mb-5 list-disc space-y-1 pl-5 text-sm text-muted">
              <li>Se borrarán la campaña, su imagen, su logo y todo su homebrew.</li>
              <li>Los personajes no se borran: seguirán existiendo, pero sin campaña asignada.</li>
              <li>
                <strong className="text-white">Esta acción no se puede deshacer.</strong>
              </li>
            </ul>

            <label htmlFor="confirm-name" className="mb-1.5 block text-sm">
              Para confirmar, escribe el nombre de la campaña:{" "}
              <strong className="break-all font-semibold text-white">{campaignName}</strong>
            </label>
            <input
              id="confirm-name"
              ref={inputRef}
              type="text"
              value={typed}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmDelete()}
              className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-fg focus:border-brand focus:outline-none"
            />
            {error && (
              <p className="mt-2 text-sm text-brand-soft" role="alert">
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={close}
                disabled={loading}
                className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors enabled:hover:text-white disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={!matches || loading}
                className="flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-bold text-white transition-colors enabled:hover:bg-brand-hover disabled:opacity-50"
              >
                {loading && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
                Borrar definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}