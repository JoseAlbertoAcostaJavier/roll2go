"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, TriangleAlert } from "lucide-react";

type Step = "closed" | "confirm" | "notes";

/* Expulsar a un participante en dos pasos: confirmar (con la opción de añadirlo a la lista de bloqueados) y,
   si tenía notas en el diario, decidir si se mantienen (por defecto) o se borran. */
export default function ExpelMember({
  campaignId,
  userId,
  name,
}: {
  campaignId: string;
  userId: string;
  name: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("closed");
  const [ban, setBan] = useState(false);
  const [notes, setNotes] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // La página se refresca solo al terminar: la fila del expulsado desaparece y, si se hiciera antes,
  // se cerraría el cuadro a mitad del proceso
  function finish() {
    setStep("closed");
    router.refresh();
  }

  // Escape: en el primer paso cancela; en el segundo equivale a "Mantener las notas"
  useEffect(() => {
    if (step === "closed" || loading) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (step === "confirm") {
        setStep("closed");
        setError("");
      } else {
        setStep("closed");
        router.refresh();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, loading, router]);

  async function call(url: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? `El servidor ha respondido con un error (${res.status}).`);
        return null;
      }
      return data;
    } catch {
      setError("No se pudo conectar con el servidor.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function expel() {
    const data = await call(`/api/campaigns/${campaignId}/members/${userId}${ban ? "?ban=1" : ""}`);
    if (!data) return;
    if (data.notes > 0) {
      setNotes(data.notes);
      setStep("notes");
    } else finish();
  }

  async function deleteNotes() {
    const data = await call(`/api/campaigns/${campaignId}/members/${userId}/notes`);
    if (data) finish();
  }

  const secondary = "rounded-md border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors enabled:hover:text-white disabled:opacity-50";
  const primary = "flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-bold text-white transition-colors enabled:hover:bg-brand-hover disabled:opacity-50";

  return (
    <>
      <button type="button" onClick={() => setStep("confirm")} className="text-sm text-brand-soft hover:underline">
        Expulsar
      </button>

      {step !== "closed" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="expel-title"
            className="w-full max-w-md rounded-xl border border-line bg-panel p-6 shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
          >
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand-soft">
                <TriangleAlert size={20} aria-hidden="true" />
              </span>
              <h3 id="expel-title" className="break-words font-heading text-xl font-bold">
                {step === "confirm" ? `¿Expulsar a ${name}?` : `${name} ha sido expulsado`}
              </h3>
            </div>

            {step === "confirm" ? (
              <>
                <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-muted">
                  <li>Sus personajes de la campaña se quedarán sin campaña.</li>
                  <li>Sus notas del diario se mantienen. Podrás borrarlas a continuación.</li>
                  <li>Recibirá una notificación.</li>
                </ul>
                <label className="mb-5 flex cursor-pointer items-start gap-3 text-sm">
                  <input type="checkbox" checked={ban} onChange={(e) => setBan(e.target.checked)} className="mt-1 h-4 w-4 accent-brand" />
                  <span>
                    <span className="block font-semibold">Añadir a la lista de bloqueados de la campaña</span>
                    <span className="block text-muted">No podrá volver a unirse por ningún enlace ni invitación.</span>
                  </span>
                </label>
                {error && <p className="mb-4 text-sm text-brand-soft" role="alert">{error}</p>}
                <div className="flex flex-wrap justify-end gap-3">
                  <button type="button" onClick={() => { setStep("closed"); setError(""); }} disabled={loading} className={secondary}>
                    Cancelar
                  </button>
                  <button type="button" onClick={expel} disabled={loading} className={primary}>
                    {loading && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
                    Expulsar
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mb-5 text-sm text-muted">
                  Tenía <strong className="text-white">{notes}</strong> {notes === 1 ? "nota" : "notas"} en el diario de
                  la campaña. Por defecto se mantienen, pero puedes borrarlas ahora.
                </p>
                {error && <p className="mb-4 text-sm text-brand-soft" role="alert">{error}</p>}
                <div className="flex flex-wrap justify-end gap-3">
                  <button type="button" onClick={deleteNotes} disabled={loading} className={secondary}>
                    {loading ? "Borrando..." : `Borrar ${notes === 1 ? "su nota" : "sus notas"}`}
                  </button>
                  <button type="button" onClick={finish} disabled={loading} autoFocus className={primary}>
                    Mantener las notas
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}