"use client";

import { useMemo, useState } from "react";
import { BookPlus, LoaderCircle, TriangleAlert } from "lucide-react";
import type { SpellOption } from "@/lib/rules/catalog/types";
import type { CasterBlock } from "@/lib/rules/dnd2024/derive";
import { refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import { spellOptionName, spellOptionTitle } from "@/lib/rules/dnd2024/sheet/labels";
import type { SpellOp } from "@/lib/rules/dnd2024/spells/spellOps";
import type { Ref } from "@/lib/rules/types";
import { field, labelClass, primaryButton } from "@/app/components/ui/formStyles";
import RuleSelect from "../creator/RuleSelect";
import MasterySelector from "./MasterySelector";

// Lo que cada clase lanzadora tiene además de preparar: la alternativa de conjuros de su subclase, Dominio de conjuros y,
// en el Mago, copiar conjuros a su libro. Sin nada de eso no pinta nada.
export default function SpellBlockTools({ block, listId, spells, isOwner, busy, onOp }: {
  block: CasterBlock;
  /** Lista de conjuros de la clase (`SpellData.classes`). */
  listId: string;
  spells: Map<string, SpellOption>;
  isOwner: boolean;
  busy: boolean;
  onOp: (op: SpellOp) => Promise<boolean>;
}) {
  const [copyRef, setCopyRef] = useState<Ref | null>(null);
  const id = `spell-tools-${refKey(block.class)}`.replace(/[^\w-]/g, "_");
  const book = useMemo(() => new Set(block.spellbook.map((s) => refKey(s.ref))), [block.spellbook]);
  // Conjuros que el Mago puede copiar a su libro: de su lista, de nivel 1 hasta el máximo y que no tenga ya
  const copyable = useMemo(() => (block.mode === "spellbook" && isOwner
    ? [...spells.values()].filter((s) => s.data.classes.includes(listId) && s.data.level >= 1 && s.data.level <= block.maxSpellLevel && !book.has(refKey(s.ref)))
    : []), [block.mode, block.maxSpellLevel, isOwner, spells, listId, book]);
  const options = block.spellOptions;

  async function copy() {
    if (copyRef && (await onOp({ op: "copy", ref: copyRef }))) setCopyRef(null);
  }

  return (
    <div className="space-y-3 empty:hidden print:hidden">
      {options && (isOwner ? (
        <div className="max-w-xs">
          <label htmlFor={`${id}-option`} className={labelClass}>{spellOptionTitle(options.subclass.key)}</label>
          <select
            id={`${id}-option`}
            className={field}
            value={options.current ?? ""}
            disabled={busy}
            onChange={(e) => void onOp({ op: "setOption", subclass: options.subclass, name: e.target.value || null })}
          >
            <option value="">Sin elegir</option>
            {options.names.map((n) => <option key={n} value={n}>{spellOptionName(n)}</option>)}
          </select>
        </div>
      ) : (
        <p className="text-sm"><span className="font-semibold">{spellOptionTitle(options.subclass.key)}:</span> {options.current ? spellOptionName(options.current) : "sin elegir"}</p>
      ))}

      {/* Mago 20 de antes de Conjuros distintivos: no puede subir más, así que los elige rehaciendo el nivel */}
      {isOwner && block.signatureMissing && (
        <p role="status" className="flex items-start gap-2 rounded-md border border-line bg-surface p-3 text-sm text-muted">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-brand-soft" aria-hidden="true" />
          <span>Para elegir tus Conjuros distintivos, borra el nivel 20 y vuelve a subirlo.</span>
        </p>
      )}

      <MasterySelector
        id={`${id}-mastery`}
        block={block}
        spells={spells}
        isOwner={isOwner}
        busy={busy}
        onChange={(level, ref) => void onOp({ op: "setMastery", level, ref })}
      />

      {copyable.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1 basis-56">
            <RuleSelect id={`${id}-copy`} label="Copiar conjuro al libro" options={copyable} value={copyRef} onChange={setCopyRef} placeholder="Busca un conjuro de tu lista" />
          </div>
          <button type="button" onClick={copy} disabled={!copyRef || busy} className={primaryButton}>
            {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <BookPlus size={16} aria-hidden="true" />}
            Copiar
          </button>
        </div>
      )}
    </div>
  );
}
