"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import PasswordInput from "@/app/components/PasswordInput";
import { field, labelClass } from "@/app/components/formStyles";

export default function DeleteAccountForm({ username }: { username: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (typed.trim() !== username || !password) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmUsername: typed.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return setError(data?.error ?? `El servidor ha respondido con un error (${res.status}).`);
      router.push("/");
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-brand/50 bg-brand/5 p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand-soft">
          <TriangleAlert size={20} aria-hidden="true" />
        </span>
        <h2 className="font-heading text-xl font-bold text-brand-soft">Borrar cuenta</h2>
      </div>
      <ul className="mb-5 list-disc space-y-1 pl-5 text-sm text-muted">
        <li>Se borrarán tu perfil, tus personajes, tus amistades y las notas que hayas escrito.</li>
        <li>Se borrarán también las campañas de las que eres DM, con su contenido. Los personajes de otros jugadores se quedarán sin campaña.</li>
        <li><strong className="text-white">Esta acción no se puede deshacer.</strong></li>
      </ul>

      <div className="mb-4">
        <label htmlFor="del-pw" className={labelClass}>Tu contraseña</label>
        <PasswordInput id="del-pw" value={password} onChange={setPassword} autoComplete="current-password" />
      </div>
      <div className="mb-4">
        <label htmlFor="del-user" className={labelClass}>
          Para confirmar, escribe tu nombre de usuario: <strong className="text-white">{username}</strong>
        </label>
        <input id="del-user" type="text" autoComplete="off" spellCheck={false} value={typed} onChange={(e) => setTyped(e.target.value)} className={field} />
      </div>

      {error && <p className="mb-4 text-sm text-brand-soft" role="alert">{error}</p>}
      <button
        type="submit"
        disabled={loading || !password || typed.trim() !== username}
        className="flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 font-heading font-bold text-white transition-colors enabled:hover:bg-brand-hover disabled:opacity-50"
      >
        {loading && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
        Borrar mi cuenta definitivamente
      </button>
    </form>
  );
}