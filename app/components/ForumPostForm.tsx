"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import BbcodeEditor from "@/app/components/BbcodeEditor";
import { errorClass, field, labelClass, primaryButton } from "@/app/components/formStyles";
import { MAX_CONTENT, MAX_TITLE } from "@/lib/forum";

type Props = {
  campaignId: string;
  kind: "post" | "reply"; // mensaje principal (con título) o respuesta
  parent?: string; // respuesta nueva: id del mensaje principal
  replyTo?: string; // respuesta nueva: id de la respuesta concreta a la que se contesta
  editId?: string; // si existe, se edita ese mensaje
  initial?: { title: string; content: string };
  onDone?: () => void; // cierra el formulario cuando está dentro de un mensaje
};

export default function ForumPostForm({ campaignId, kind, parent, replyTo, editId, initial, onDone }: Props) {
  const router = useRouter();
  const uid = useId();
  const editing = !!editId;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [errors, setErrors] = useState<{ title?: string; content?: string }>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    const found: typeof errors = {};
    if (kind === "post" && !title.trim()) found.title = "El título es obligatorio.";
    if (!content.trim()) found.content = "Escribe el mensaje.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch(
        editing ? `/api/campaigns/${campaignId}/forum/${editId}` : `/api/campaigns/${campaignId}/forum`,
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editing ? { title: title.trim(), content } : { title: title.trim(), content, parent, replyTo },
          ),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.errors) setErrors(data.errors);
        else setFormError(data?.error ?? `El servidor ha respondido con un error (${res.status}).`);
        return;
      }

      if (editing) {
        onDone?.();
        router.refresh();
      } else if (kind === "post") {
        router.push(`/campaigns/${campaignId}/forum/${data.id}`);
        router.refresh();
      } else {
        // Respuesta: se lleva al autor a la página del hilo donde ha quedado, justo a su mensaje
        setContent("");
        onDone?.();
        router.push(`/campaigns/${campaignId}/forum/${data.rootId}?page=${data.page}#msg-${data.id}`);
        router.refresh();
      }
    } catch {
      setFormError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {kind === "post" && (
        <div>
          <label htmlFor={`${uid}-title`} className={labelClass}>Título</label>
          <input
            id={`${uid}-title`}
            type="text"
            maxLength={MAX_TITLE}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={field}
          />
          {errors.title && <p className={errorClass} role="alert">{errors.title}</p>}
        </div>
      )}

      <div>
        <label htmlFor={`${uid}-content`} className={labelClass}>{kind === "post" ? "Mensaje" : "Tu respuesta"}</label>
        <BbcodeEditor
          id={`${uid}-content`}
          value={content}
          onChange={setContent}
          maxLength={MAX_CONTENT}
          rows={kind === "post" ? 8 : 4}
        />
        {errors.content && <p className={errorClass} role="alert">{errors.content}</p>}
      </div>

      {formError && <p className="text-sm text-brand-soft" role="alert">{formError}</p>}

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={loading} className={primaryButton}>
          {loading && <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />}
          {editing ? "Guardar cambios" : kind === "post" ? "Publicar mensaje" : "Responder"}
        </button>
        {onDone && (
          <button type="button" onClick={onDone} disabled={loading} className="text-sm text-muted hover:text-white disabled:opacity-50">
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}