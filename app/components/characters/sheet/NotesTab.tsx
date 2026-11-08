"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import type { Dnd2024SheetV2, NoteCategory } from "@/lib/rules/dnd2024/sheet/sheet";
import { CUSTOM_LIMITS } from "@/lib/rules/dnd2024/sheet/custom";
import { field } from "@/app/components/ui/formStyles";
import { InlineText } from "./InlineText";
import { customOp } from "./OrderedSection";
import PanelSearch from "./PanelSearch";
import { SectionBar } from "./statUi";

// Pestaña Notas: organizaciones, aliados, enemigos, otras notas y las categorías propias, editables en el sitio por el dueño
export default function NotesTab({ characterId, isOwner, sheet, notes }: {
  characterId: string; isOwner: boolean; sheet: Dnd2024SheetV2; notes: NoteCategory[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const fields = [
    { field: "organizations", label: "Organizaciones", value: sheet.organizations },
    { field: "allies", label: "Aliados", value: sheet.allies },
    { field: "enemies", label: "Enemigos", value: sheet.enemies },
    { field: "notes", label: "Otras notas", value: sheet.notes },
  ] as const;

  const run = async (op: object) => {
    const message = await customOp(characterId, op);
    setError(message ?? "");
    if (!message) router.refresh();
    return !message;
  };

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (await run({ op: "addNote", title })) {
      setTitle("");
      setAdding(false);
    }
  }

  return (
    <div className="animate-fade-up space-y-4">
      <div className="print:hidden"><PanelSearch label="Buscar en las notas" /></div>
      {fields.map((f) => (
        <section key={f.field} data-search={`${f.label} ${f.value ?? ""}`} aria-label={f.label} className="space-y-2">
          <SectionBar title={f.label} />
          <div className="px-3">
            <InlineText characterId={characterId} field={f.field} label={f.label} value={f.value ?? ""} multiline editable={isOwner} hideLabel />
          </div>
        </section>
      ))}
      {notes.map((n) => (
        <section key={n.id} data-search={`${n.title} ${n.text}`} aria-label={n.title} className="space-y-2">
          <SectionBar title={n.title}>
            {isOwner && (
              <button type="button" aria-label={`Borrar ${n.title}`} title="Borrar categoría" onClick={() => run({ op: "removeNote", id: n.id })} className="text-muted hover:text-danger print:hidden">
                <Trash2 size={14} aria-hidden="true" />
              </button>
            )}
          </SectionBar>
          <div className="px-3">
            {isOwner ? (
              <textarea
                key={n.text}
                aria-label={n.title}
                rows={3}
                maxLength={CUSTOM_LIMITS.noteText}
                defaultValue={n.text}
                onBlur={(e) => e.target.value !== n.text && run({ op: "updateNote", id: n.id, text: e.target.value })}
                className={`${field} text-sm print:hidden`}
              />
            ) : null}
            <p className={`whitespace-pre-wrap text-sm ${isOwner ? "hidden print:block" : ""}`}>{n.text || "—"}</p>
          </div>
        </section>
      ))}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {isOwner && (adding ? (
        <form onSubmit={addCategory} className="flex flex-wrap items-center gap-2 print:hidden">
          <input autoFocus required aria-label="Título de la categoría" maxLength={CUSTOM_LIMITS.name} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título de la categoría" className={`${field} min-w-0 flex-1 py-1.5! text-sm`} />
          <button type="submit" className="rounded-md border border-line-strong px-3 py-1.5 text-sm font-semibold text-fg hover:border-fg">Añadir</button>
          <button type="button" onClick={() => setAdding(false)} className="text-sm font-semibold text-muted hover:text-white">Cancelar</button>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="flex w-full items-center gap-2 rounded-md bg-surface px-3 py-1.5 font-heading text-sm font-bold uppercase text-brand-soft transition-colors hover:text-white print:hidden">
          <Plus size={16} aria-hidden="true" /> Añadir categoría
        </button>
      ))}
    </div>
  );
}
