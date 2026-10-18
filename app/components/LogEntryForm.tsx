"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Globe, LoaderCircle, Lock } from "lucide-react";
import BbcodeEditor from "@/app/components/BbcodeEditor";

type Visibility = "public" | "private";
type Errors = Partial<Record<"title" | "content" | "visibility", string>>;

const field =
  "w-full rounded-md border border-line bg-surface px-3 py-2.5 text-fg placeholder:text-muted focus:border-brand focus:outline-none";
const labelClass = "mb-1.5 block text-sm font-semibold";
const errorClass = "mt-1 text-xs text-brand-soft";

export default function LogEntryForm({
  campaignId,
  entryId,
  initial,
}: {
  campaignId: string;
  entryId?: string; // si existe, se está editando
  initial?: { title: string; content: string; visibility: Visibility };
}) {
  const router = useRouter();
  const editing = !!entryId;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  // Por defecto privada: así no se publica nada por descuido
  const [visibility, setVisibility] = useState<Visibility>(initial?.visibility ?? "private");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setFormError("");

    const found: Errors = {};
    if (!title.trim()) found.title = "El título es obligatorio.";
    if (!content.trim()) found.content = "Escribe el contenido de la nota.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch(
        editing ? `/api/campaigns/${campaignId}/log/${entryId}` : `/api/campaigns/${campaignId}/log`,
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), content, visibility }),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.errors) setErrors(data.errors);
        else setFormError(data?.error ?? `El servidor ha respondido con un error (${res.status}).`);
        return;
      }
      router.push(`/campaigns/${campaignId}/log`);
      router.refresh();
    } catch {
      setFormError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <div>
        <label htmlFor="title" className={labelClass}>Título</label>
        <input id="title" type="text" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
        {errors.title && <p className={errorClass} role="alert">{errors.title}</p>}
      </div>

      <fieldset>
        <legend className={labelClass}>Visibilidad</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ["private", "Privada", "Solo tú y el DM podéis verla.", Lock],
            ["public", "Pública", "La ven todos los participantes de la campaña.", Globe],
          ] as const).map(([value, name, desc, Icon]) => (
            <label
              key={value}
              className={`flex cursor-pointer gap-3 rounded-md border p-3 ${
                visibility === value ? "border-brand bg-brand/10" : "border-line"
              }`}
            >
              <input
                type="radio"
                name="visibility"
                value={value}
                checked={visibility === value}
                onChange={() => setVisibility(value)}
                className="mt-1 accent-brand"
              />
              <span>
                <span className="flex items-center gap-2 font-semibold">
                  <Icon size={14} aria-hidden="true" /> {name}
                </span>
                <span className="block text-sm text-muted">{desc}</span>
              </span>
            </label>
          ))}
        </div>
        {errors.visibility && <p className={errorClass} role="alert">{errors.visibility}</p>}
      </fieldset>

      <div>
        <label htmlFor="content" className={labelClass}>Contenido</label>
        <BbcodeEditor id="content" value={content} onChange={setContent} maxLength={50000} />
        {errors.content && <p className={errorClass} role="alert">{errors.content}</p>}
      </div>

      {formError && <p className="text-sm text-brand-soft" role="alert">{formError}</p>}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 rounded-md bg-brand px-6 py-2.5 font-heading font-bold text-white transition-colors enabled:hover:bg-brand-hover disabled:opacity-50"
        >
          {loading && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
          {editing ? "Guardar cambios" : "Publicar nota"}
        </button>
        <Link href={`/campaigns/${campaignId}/log`} className="text-sm text-muted hover:text-white">
          Cancelar
        </Link>
      </div>
    </form>
  );
}