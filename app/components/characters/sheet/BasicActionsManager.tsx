"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Settings } from "lucide-react";
import { CUSTOM_LIMITS } from "@/lib/rules/dnd2024/sheet/custom";
import { field } from "@/app/components/ui/formStyles";
import { customOp } from "./OrderedSection";
import StatDialog from "./StatDialog";

/** Una acción básica en el gestor: `text`, su descripción en texto llano para editarla. */
export type BasicActionOption = {
  key: string;
  name: string;
  book: string;
  group: "action" | "bonus" | "reaction" | "other";
  core: boolean;
  active: boolean;
  editable: boolean;
  edited: boolean;
  text: string;
};

// Engranaje de «Acciones en combate»: activa o desactiva cada acción y, en las que no tienen texto oficial en español,
// permite ponerles nombre y descripción propios. Cada cambio se guarda al momento.
export default function BasicActionsManager({ characterId, title, options }: { characterId: string; title: string; options: BasicActionOption[] }) {
  const router = useRouter();
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isOn = (o: BasicActionOption) => active[o.key] ?? o.active;
  const books = [...new Set(options.map((o) => o.book))];

  async function send(op: object) {
    setBusy(true);
    const message = await customOp(characterId, op);
    setBusy(false);
    setError(message ?? "");
    if (!message) router.refresh();
    return !message;
  }

  async function toggle(o: BasicActionOption, on: boolean) {
    setActive((a) => ({ ...a, [o.key]: on }));
    if (!(await send({ op: "basicActive", key: o.key, active: on, core: o.core }))) setActive((a) => ({ ...a, [o.key]: !on }));
  }

  function startEdit(o: BasicActionOption) {
    setEditing(o.key);
    setName(o.name);
    setText(o.text);
    setError("");
  }

  async function saveEdit(e: React.FormEvent, key: string) {
    e.preventDefault();
    if (await send({ op: "basicEdit", key, name, details: text })) setEditing(null);
  }

  async function clearEdit(key: string) {
    if (await send({ op: "basicEditClear", key })) setEditing(null);
  }

  return (
    <>
      <button
        type="button"
        aria-label={`Gestionar ${title}`}
        title="Gestionar acciones"
        onClick={(e) => setOpener(e.currentTarget)}
        className="rounded p-0.5 text-muted transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-brand print:hidden"
      >
        <Settings size={16} aria-hidden="true" />
      </button>

      {opener && (
        <StatDialog title={title} description="" onClose={() => { setOpener(null); setEditing(null); }} opener={opener}>
          <p className="mb-3 text-sm text-muted">Activa las que quieras ver en la ficha. Las que no tienen texto oficial en español se pueden renombrar y traducir.</p>
          {books.map((book) => (
            <section key={book} className="mb-4" aria-label={book}>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{book}</h4>
              <ul>
                {options.filter((o) => o.book === book).map((o) => (
                  <li key={o.key} className="rounded-md px-2 py-1 hover:bg-surface">
                    <div className="flex items-center gap-2">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                        <input type="checkbox" checked={isOn(o)} aria-disabled={busy} onChange={(e) => !busy && void toggle(o, e.target.checked)} className="h-4 w-4 shrink-0 accent-brand" />
                        <span className="truncate">{o.name}</span>
                        {o.edited && <span className="shrink-0 text-xs text-muted">(editada)</span>}
                      </label>
                      {o.editable && (
                        <button type="button" aria-label={`Editar ${o.name}`} title="Editar" aria-expanded={editing === o.key} onClick={() => (editing === o.key ? setEditing(null) : startEdit(o))} className="shrink-0 text-muted transition-colors hover:text-white">
                          <Pencil size={15} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    {editing === o.key && (
                      <form onSubmit={(e) => void saveEdit(e, o.key)} className="mt-2 space-y-2 pb-2">
                        <label className="block text-xs font-semibold text-muted">Nombre
                          <input autoFocus required maxLength={CUSTOM_LIMITS.name} value={name} onChange={(e) => setName(e.target.value)} className={`${field} mt-1 py-1.5! text-sm`} />
                        </label>
                        <label className="block text-xs font-semibold text-muted">Descripción
                          <textarea rows={5} maxLength={CUSTOM_LIMITS.text} value={text} onChange={(e) => setText(e.target.value)} className={`${field} mt-1 py-1.5! text-sm`} />
                        </label>
                        <div className="flex justify-end gap-3">
                          {o.edited && <button type="button" disabled={busy} onClick={() => void clearEdit(o.key)} className="mr-auto text-sm font-semibold text-muted hover:text-white">Restablecer</button>}
                          <button type="button" onClick={() => setEditing(null)} className="text-sm font-semibold text-muted hover:text-white">Cancelar</button>
                          <button type="submit" disabled={busy} className="rounded-md bg-brand px-3 py-1.5 text-sm font-bold text-white transition-colors enabled:hover:bg-brand-hover disabled:opacity-50">Guardar</button>
                        </div>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        </StatDialog>
      )}
    </>
  );
}
