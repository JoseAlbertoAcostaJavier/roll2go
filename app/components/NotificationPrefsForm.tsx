"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { card, cardTitle, primaryButton, successClass } from "@/app/components/formStyles";
import { CAMPAIGN_EMAIL_PREFS, type CampaignEmailPref } from "@/lib/notificationText";

export type Prefs = {
  messages: boolean;
  social: boolean;
  campaignTypes: Record<CampaignEmailPref, boolean>;
};

const checkbox = "mt-1 h-4 w-4 shrink-0 accent-brand";

function Option({
  checked,
  onChange,
  title,
  desc,
  inputRef,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  desc: string;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md p-2 transition-colors hover:bg-surface">
      <input ref={inputRef} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className={checkbox} />
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted">{desc}</span>
      </span>
    </label>
  );
}

export default function NotificationPrefsForm({ initial }: { initial: Prefs }) {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const allRef = useRef<HTMLInputElement>(null);

  const types = Object.values(prefs.campaignTypes);
  const all = types.every(Boolean);
  const some = types.some(Boolean);

  // "Campañas" marca o desmarca todos los tipos; si solo hay algunos, se ve a medias
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = some && !all;
  }, [some, all]);

  function setAll(v: boolean) {
    setPrefs((p) => ({
      ...p,
      campaignTypes: Object.fromEntries(CAMPAIGN_EMAIL_PREFS.map(({ key }) => [key, v])) as Prefs["campaignTypes"],
    }));
    setSaved(false);
  }

  function set<K extends "messages" | "social">(key: K, v: boolean) {
    setPrefs((p) => ({ ...p, [key]: v }));
    setSaved(false);
  }

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
      <p className="mb-5 text-sm text-muted">Elige qué notificaciones quieres recibir por correo.</p>

      <div className="space-y-1">
        <fieldset>
          <legend className="sr-only">Campañas</legend>
          <Option
            inputRef={allRef}
            checked={all}
            onChange={setAll}
            title="Campañas"
            desc="Todos los avisos de tus campañas. También puedes elegir solo algunos."
          />
          <div className="ml-4 space-y-0.5 border-l-2 border-line pl-4">
            {CAMPAIGN_EMAIL_PREFS.map(({ key, title, desc }) => (
              <Option
                key={key}
                checked={prefs.campaignTypes[key]}
                onChange={(v) => {
                  setPrefs((p) => ({ ...p, campaignTypes: { ...p.campaignTypes, [key]: v } }));
                  setSaved(false);
                }}
                title={title}
                desc={desc}
              />
            ))}
          </div>
        </fieldset>
        <Option
          checked={prefs.messages}
          onChange={(v) => set("messages", v)}
          title="Mensajes"
          desc="Cuando alguien te escribe un mensaje directo. El correo incluye lo que te ha dicho."
        />
        <Option checked={prefs.social} onChange={(v) => set("social", v)} title="Social" desc="Solicitudes de amistad y aceptaciones." />
      </div>

      {error && <p className="mt-4 text-sm text-brand-soft" role="alert">{error}</p>}
      <div className="mt-6 flex items-center gap-4">
        <button type="submit" disabled={loading} className={primaryButton}>
          {loading && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />} Guardar preferencias
        </button>
        {saved && <span className={`${successClass} animate-fade-in`} role="status">Preferencias guardadas.</span>}
      </div>
    </form>
  );
}
