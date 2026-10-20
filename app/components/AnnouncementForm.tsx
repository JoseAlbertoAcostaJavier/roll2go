"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { card, cardTitle, field, labelClass, primaryButton, successClass } from "@/app/components/formStyles";

export default function AnnouncementForm() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<number | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSent(null);
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return setError(data?.error ?? `El servidor ha respondido con un error (${res.status}).`);
      setSent(data.sent);
      setText("");
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className={card}>
      <h2 className={cardTitle}>Aviso a todos los usuarios</h2>
      <label htmlFor="announce" className={labelClass}>Texto del aviso</label>
      <textarea id="announce" rows={4} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} className={field} />
      <p className="mt-1 text-right text-xs text-muted">{text.length}/500</p>
      {error && <p className="mt-2 text-sm text-brand-soft" role="alert">{error}</p>}
      <div className="mt-4 flex items-center gap-4">
        <button type="submit" disabled={loading || text.trim().length < 3} className={primaryButton}>
          {loading && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />} Enviar a todos
        </button>
        {sent !== null && <span className={successClass} role="status">Enviado a {sent} usuarios.</span>}
      </div>
    </form>
  );
}