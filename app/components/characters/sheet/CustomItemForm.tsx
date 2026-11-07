"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { CUSTOM_LIMITS } from "@/lib/rules/dnd2024/sheet/custom";
import type { CustomItem } from "@/lib/rules/dnd2024/sheet/sheet";
import { field, secondaryButtonSm } from "@/app/components/ui/formStyles";
import { customOp } from "./OrderedSection";

const input = `${field} py-1.5! text-sm`;
const label = "mb-1 block text-xs font-semibold text-muted";

// Formulario del «+» de una sección: añade un ataque, una acción o un rasgo propio a la hoja
export default function CustomItemForm({ characterId, kind, group, onClose }: {
  characterId: string;
  kind: CustomItem["kind"];
  /** Grupo de la acción o sección del rasgo. */
  group?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [v, setV] = useState({ name: "", range: "", hit: "", damage: "", notes: "", details: "", source: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const item = kind === "attack"
      ? { kind, name: v.name, range: v.range, hit: v.hit, damage: v.damage, notes: v.notes }
      : kind === "action" ? { kind, group, name: v.name, details: v.details }
        : { kind, section: group, name: v.name, source: v.source, description: v.description };
    const message = await customOp(characterId, { op: "addItem", item });
    setSaving(false);
    if (message) return setError(message);
    onClose();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-2 animate-fade-in space-y-2 rounded-md border border-line bg-surface/40 p-3 print:hidden">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <div className={kind === "attack" ? "" : "sm:col-span-4"}>
          <label className={label}>Nombre
            <input autoFocus required maxLength={CUSTOM_LIMITS.name} value={v.name} onChange={set("name")} className={input} />
          </label>
        </div>
        {kind === "attack" && (
          <>
            <label className={label}>Alcance<input maxLength={CUSTOM_LIMITS.short} value={v.range} onChange={set("range")} placeholder="1,5 m" className={input} /></label>
            <label className={label}>Golpe/CD<input maxLength={CUSTOM_LIMITS.short} value={v.hit} onChange={set("hit")} placeholder="+5" className={input} /></label>
            <label className={label}>Daño<input maxLength={CUSTOM_LIMITS.short} value={v.damage} onChange={set("damage")} placeholder="1d6+3" className={input} /></label>
          </>
        )}
      </div>
      {kind === "attack" && <label className={label}>Notas<input maxLength={CUSTOM_LIMITS.text} value={v.notes} onChange={set("notes")} className={input} /></label>}
      {kind === "action" && <label className={label}>Detalle<textarea rows={2} maxLength={CUSTOM_LIMITS.text} value={v.details} onChange={set("details")} className={input} /></label>}
      {kind === "feature" && (
        <>
          <label className={label}>Origen<input maxLength={CUSTOM_LIMITS.short} value={v.source} onChange={set("source")} placeholder="Clase, especie…" className={input} /></label>
          <label className={label}>Descripción<textarea rows={3} maxLength={CUSTOM_LIMITS.text} value={v.description} onChange={set("description")} className={input} /></label>
        </>
      )}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="text-sm font-semibold text-muted hover:text-white">Cancelar</button>
        <button type="submit" disabled={saving} className={secondaryButtonSm}>
          {saving && <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />} Añadir
        </button>
      </div>
    </form>
  );
}
