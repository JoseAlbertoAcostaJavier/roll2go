"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { card, cardTitle, primaryButton, successClass } from "@/app/components/formStyles";

type Prefs = { campaigns: boolean; messages: boolean; social: boolean };

const OPTIONS: { key: keyof Prefs; title: string; desc: string }[] = [
  { key: "campaigns", title: "Campañas", desc: "Nuevas notas, mensajes del foro, invitaciones, expulsiones y avisos del DM." },
  { key: "messages", title: "Mensajes", desc: "Cuando alguien te escribe un mensaje directo." },
  { key: "social", title: "Social", desc: "Solicitudes de amistad y aceptaciones." },
];

export default function NotificationPrefsForm({ initial }: { initial: Prefs }) {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "notifications", ...prefs }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return setError(data?.error ?? `El servidor ha respondido con un error (${res.status}).`);
      setSaved(true);
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={save} className={card}>
      <h2 className={cardTitle}>Notificaciones por correo</h2>
      <p className="mb-5 text-sm text-muted">
        Las notificaciones siempre aparecen dentro de Roll2Go. Aquí eliges de qué tipo quieres recibir, además, un correo.
      </p>
      <div className="space-y-4">
        {OPTIONS.map(({ key, title, desc }) => (
          <label key={key} className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={prefs[key]}
              onChange={(e) => setPrefs((p) => ({ ...p, [key]: e.target.checked }))}
              className="mt-1 h-4 w-4 accent-brand"
            />
            <span>
              <span className="block font-semibold">{title}</span>
              <span className="block text-sm text-muted">{desc}</span>
            </span>
          </label>
        ))}
      </div>
      {error && <p className="mt-4 text-sm text-brand-soft" role="alert">{error}</p>}
      <div className="mt-6 flex items-center gap-4">
        <button type="submit" disabled={loading} className={primaryButton}>
          {loading && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />} Guardar preferencias
        </button>
        {saved && <span className={successClass} role="status">Preferencias guardadas.</span>}
      </div>
    </form>
  );
}