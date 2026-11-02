"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SHEET_TEXT_LIMITS, type SheetTextField } from "@/lib/rules/dnd2024/sheet/textFields";
import { errorClass, field as fieldClass } from "@/app/components/ui/formStyles";

type Common = { characterId: string; field: SheetTextField; label: string; editable: boolean };

// Guarda un campo de la hoja (`PATCH /api/characters/[id]`); devuelve el mensaje de error o null si salió bien
async function saveField(characterId: string, name: SheetTextField, value: string): Promise<string | null> {
  const fd = new FormData();
  fd.set(name, value);
  try {
    const res = await fetch(`/api/characters/${characterId}`, { method: "PATCH", body: fd });
    if (res.ok) return null;
    const data = (await res.json().catch(() => null)) as { errors?: Record<string, string>; error?: string } | null;
    return data?.errors?.[name] ?? data?.error ?? "No se pudo guardar.";
  } catch {
    return "No se pudo guardar.";
  }
}

// Valor local hasta que llega el refresco del servidor (así no parpadea el antiguo); se sincroniza si cambia el de fuera
function useShown(value: string) {
  const [shown, setShown] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setShown(value);
  }
  return [shown, setShown] as const;
}

const labelText = "text-xs font-semibold uppercase tracking-wide text-muted";
const valueButton =
  "block w-full rounded-md px-1.5 py-1 -mx-1.5 text-left text-sm text-fg hover:bg-surface focus-visible:bg-surface";

// Campo de la ficha editable en el sitio (spec de rasgos §6). El dueño ve el valor como un botón que abre la edición
// (o «+ Añadir …» si está vacío); los demás, el valor o «—». Guarda al salir del campo, con Enter (en un textarea,
// Ctrl/Cmd+Enter); Escape cancela y devuelve el foco al botón.
export function InlineText({ characterId, field, label, value, multiline, editable }: Common & { value: string; multiline?: boolean }) {
  const router = useRouter();
  const max = SHEET_TEXT_LIMITS[field];
  const [shown, setShown] = useShown(value);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const button = useRef<HTMLButtonElement>(null);
  const cancelled = useRef(false);
  const returnFocus = useRef(false);
  const inputId = `inline-${characterId}-${field}`;

  const open = () => {
    cancelled.current = false;
    setDraft(shown);
    setError("");
    setEditing(true);
  };

  // Cierra la edición y pide devolver el foco al botón; el efecto de abajo lo hace cuando el botón ya está montado.
  // `cancelled` hace que el blur del input que se desmonta no vuelva a guardar.
  const close = () => {
    cancelled.current = true;
    returnFocus.current = true;
    setEditing(false);
  };

  useEffect(() => {
    if (!editing && returnFocus.current) {
      returnFocus.current = false;
      button.current?.focus();
    }
  }, [editing]);

  async function commit(focusBack = false) {
    if (saving) return;
    const next = draft.trim();
    if (next === shown.trim()) {
      if (focusBack) close();
      else setEditing(false);
      return;
    }
    setSaving(true);
    const message = await saveField(characterId, field, next);
    setSaving(false);
    if (message) {
      setError(message);
      return;
    }
    setShown(next);
    if (focusBack) close();
    else setEditing(false);
    router.refresh();
  }

  const Control = multiline ? "textarea" : "input";

  return (
    <div className="min-w-0">
      {editing ? (
        <>
          <label htmlFor={inputId} className={`mb-1 block ${labelText}`}>{label}</label>
          <Control
            id={inputId}
            autoFocus
            value={draft}
            readOnly={saving}
            aria-busy={saving || undefined}
            rows={multiline ? 4 : undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
            className={`${fieldClass} ${multiline ? "min-h-24 resize-y" : ""}`}
            onChange={(e) => { if (!saving) setDraft(e.target.value); }}
            onBlur={() => {
              if (cancelled.current) return;
              void commit();
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                cancelled.current = true;
                close();
              } else if (e.key === "Enter" && (!multiline || e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void commit(true);
              }
            }}
          />
          <div className="mt-1 flex justify-between gap-2 text-xs text-muted">
            <span id={`${inputId}-error`} role="alert" className={error ? errorClass.replace("mt-1 ", "") : ""}>{error}</span>
            {draft.length > max * 0.8 && <span className={draft.length > max ? "text-brand-soft" : ""}>{draft.length}/{max}</span>}
          </div>
        </>
      ) : (
        <>
          <div className={labelText}>{label}</div>
          {editable ? (
            <button
              ref={button}
              type="button"
              onClick={open}
              data-print="text"
              className={`${valueButton} ${multiline ? "whitespace-pre-wrap" : ""} ${shown ? "" : "text-muted"}`}
            >
              <span className="sr-only print:hidden">Editar {label}: </span>
              {shown || (
                <>
                  <span className="print:hidden">+ Añadir {label.toLowerCase()}</span>
                  <span className="hidden print:inline">—</span>
                </>
              )}
            </button>
          ) : (
            <p className={`text-sm ${shown ? "text-fg" : "text-muted"} ${multiline ? "whitespace-pre-wrap" : ""}`}>{shown || "—"}</p>
          )}
        </>
      )}
    </div>
  );
}

// Selector editable en el sitio (el alineamiento): guarda al elegir
export function InlineSelect({ characterId, field, label, value, options, editable }: Common & {
  value: string;
  options: { id: string; name: string; description?: string }[];
}) {
  const router = useRouter();
  const [shown, setShown] = useShown(value);
  const [draft, setDraft] = useState(value);
  const [seenValue, setSeenValue] = useState(value);
  if (seenValue !== value) {
    setSeenValue(value);
    setDraft(value);
  }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Con el teclado, las flechas cambian el valor sin guardar: se guarda al confirmar (Enter o salir del campo)
  const keyboard = useRef(false);
  const inputId = `inline-${characterId}-${field}`;
  // Un valor guardado que no es de la lista se conserva como opción
  const known = options.some((o) => o.id === shown);
  const description = options.find((o) => o.id === shown)?.description;
  const nameOf = (id: string) => options.find((o) => o.id === id)?.name ?? id;

  async function commit(next: string) {
    if (saving) return;
    if (next === shown) return;
    setSaving(true);
    setError("");
    const message = await saveField(characterId, field, next);
    setSaving(false);
    if (message) {
      setError(message);
      return;
    }
    setShown(next);
    router.refresh();
  }

  return (
    <div className="min-w-0">
      {editable
        ? <label htmlFor={inputId} className={`mb-1 block ${labelText}`}>{label}</label>
        : <div className={`mb-1 ${labelText}`}>{label}</div>}
      {editable ? (
        <>
          <select
            id={inputId}
            value={draft}
            aria-busy={saving || undefined}
            onPointerDown={() => { keyboard.current = false; }}
            onKeyDown={(e) => {
              if (saving) {
                e.preventDefault();
              } else if (e.key === "Enter") {
                e.preventDefault();
                void commit(draft);
              } else if (e.key !== "Tab") {
                keyboard.current = true;
              }
            }}
            onBlur={() => { keyboard.current = false; void commit(draft); }}
            onChange={(e) => {
              if (saving) return;
              setDraft(e.target.value);
              if (!keyboard.current) void commit(e.target.value);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
            className={`${fieldClass} py-1.5 text-sm print:hidden`}
          >
            <option value="">—</option>
            {!known && shown && <option value={shown}>{shown}</option>}
            {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <p id={`${inputId}-error`} role="alert" className={error ? "mt-1 text-xs text-brand-soft" : ""}>{error}</p>
          <p className="hidden text-sm text-fg print:block">{shown ? nameOf(shown) : "—"}</p>
        </>
      ) : (
        <p className={`text-sm ${shown ? "text-fg" : "text-muted"}`}>{shown ? nameOf(shown) : "—"}</p>
      )}
      {description && <p className="mt-1 text-xs text-muted">{description}</p>}
    </div>
  );
}
