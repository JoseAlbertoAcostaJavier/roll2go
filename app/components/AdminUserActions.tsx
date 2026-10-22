"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, LoaderCircle, TriangleAlert } from "lucide-react";
import ConfirmAction from "@/app/components/ConfirmAction";
import { field } from "@/app/components/formStyles";

const REASON_MAX = 400; // el mismo límite que en lib/adminApi.ts

const action =
  "flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm text-gray-200 transition-colors hover:bg-line hover:text-white";

// Botones de moderación de una fila del panel de usuarios: advertir, banear y quitar el baneo
export default function AdminUserActions({
  id,
  username,
  banned,
  canWarn,
  canBan,
}: {
  id: string;
  username: string;
  banned: boolean;
  canWarn: boolean; // nadie puede advertirse a sí mismo
  canBan: boolean; // ni banearse a sí mismo ni banear a otro admin
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "warn" | "ban">("idle");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  function open(next: "warn" | "ban") {
    setMode(next);
    setReason("");
    setError("");
    setDone("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${id}/${mode === "ban" ? "ban" : "warnings"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return setError(data?.error ?? `El servidor ha respondido con un error (${res.status}).`);
      setDone(mode === "ban" ? `@${username} ha sido baneado.` : `Advertencia enviada a @${username}.`);
      setMode("idle");
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  if (!canWarn && !canBan && !banned) return null;

  return (
    <div className="mt-4 border-t border-line pt-3">
      {mode === "idle" ? (
        <div className="flex flex-wrap items-center gap-2">
          {canWarn && (
            <button type="button" onClick={() => open("warn")} className={action}>
              <TriangleAlert size={14} aria-hidden="true" /> Advertir
            </button>
          )}
          {banned ? (
            <ConfirmAction
              url={`/api/admin/users/${id}/ban`}
              label="Quitar el baneo"
              question={`¿Quitar el baneo a @${username}?`}
              confirmLabel="Sí, quitarlo"
            />
          ) : (
            canBan && (
              <button
                type="button"
                onClick={() => open("ban")}
                className={`${action} border-brand-dark text-brand-soft hover:bg-brand-dark/40`}
              >
                <Ban size={14} aria-hidden="true" /> Banear
              </button>
            )
          )}
          {done && (
            <span className="text-sm text-[#6fd08c] animate-fade-in" role="status">
              {done}
            </span>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="animate-fade-in">
          <label htmlFor={`reason-${id}`} className="mb-1.5 block text-sm font-semibold">
            {mode === "ban" ? `Motivo del baneo permanente de @${username}` : `Motivo de la advertencia a @${username}`}
          </label>
          <textarea
            id={`reason-${id}`}
            rows={2}
            maxLength={REASON_MAX}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
            className={field}
          />
          <p className="mt-1 text-xs text-muted">
            {mode === "ban"
              ? "Se cerrarán sus sesiones, no podrá volver a entrar y su correo no servirá para registrarse de nuevo. Verá el motivo al intentar iniciar sesión."
              : "Se guardará en su historial y le llegará como notificación."}
            <span className="float-right">
              {reason.length}/{REASON_MAX}
            </span>
          </p>
          {error && (
            <p className="mt-2 text-sm text-brand-soft" role="alert">
              {error}
            </p>
          )}
          <div className="mt-3 flex items-center gap-3">
            <button
              type="submit"
              disabled={loading || reason.trim().length < 3}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold text-white transition-colors disabled:opacity-50 ${
                mode === "ban" ? "bg-brand enabled:hover:bg-brand-hover" : "bg-line enabled:hover:bg-[#4a4a4e]"
              }`}
            >
              {loading && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
              {mode === "ban" ? "Banear para siempre" : "Enviar advertencia"}
            </button>
            <button
              type="button"
              onClick={() => setMode("idle")}
              disabled={loading}
              className="text-sm text-muted hover:text-white disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
