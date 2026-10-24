"use client";

import { useMemo, useState } from "react";
import { BookPlus, LoaderCircle, WandSparkles } from "lucide-react";
import type { SpellOption } from "@/lib/rules/catalog";
import type { CasterBlock } from "@/lib/rules/dnd2024/derive";
import { bareName, refKey } from "@/lib/rules/dnd2024/equipmentRefs";
import { ABILITY_NAMES } from "@/lib/rules/dnd2024/labels";
import { EMPTY_SPELL_FILTER, matchesSpellFilter, type SpellFilter } from "@/lib/rules/dnd2024/spellFilters";
import type { SpellOp } from "@/lib/rules/dnd2024/spellOps";
import type { Ref } from "@/lib/rules/types";
import { card, primaryButton } from "@/app/components/formStyles";
import { CLASS_ICONS } from "@/app/components/icons/classes";
import RuleSelect from "../RuleSelect";
import SpellFilters from "./SpellFilters";
import SpellList, { type SpellOpener, type SpellRowItem } from "./SpellList";

type ListTab = "preparados" | "libro" | "disponibles" | "todos";

type Props = {
  block: CasterBlock;
  /** Identificador de la lista de conjuros de la clase (`wizard`), como en `SpellData.classes`. */
  listId: string;
  /** Identificador de la clase para su icono. */
  iconId: string;
  /** Conjuros cargados, por `libro:clave`. */
  spells: Map<string, SpellOption>;
  isOwner: boolean;
  busy: boolean;
  /** Envía una operación; devuelve si fue bien. */
  onOp: (op: SpellOp) => Promise<boolean>;
  onOpen: SpellOpener;
};

/** Aviso al llegar al límite de preparados (la casilla del resto queda desactivada). */
export const preparedFullNotice = (count: number, limit: number) =>
  `Ya tienes ${count} de ${limit} preparados. Desmarca uno para preparar otro`;

const signed = (n: number) => (n >= 0 ? `+${n}` : String(n));
const byLevelAndName = (a: SpellRowItem, b: SpellRowItem) =>
  (a.spell?.data.level ?? 0) - (b.spell?.data.level ?? 0)
  || (a.spell?.nameEs ?? a.name).localeCompare(b.spell?.nameEs ?? b.name, "es");

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-line bg-surface px-3 py-2 text-center">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="font-heading text-lg font-bold">{value}</dd>
    </div>
  );
}

// Un bloque por clase lanzadora (spec de conjuros §4.1): cabecera con característica, CD, ataque, preparados y
// trucos, y las listas Preparados / Mi lista / Disponibles / Todos. Solo el dueño ve las casillas y los botones.
export default function CasterBlockView({ block, listId, iconId, spells, isOwner, busy, onOp, onOpen }: Props) {
  const [tab, setTab] = useState<ListTab>("preparados");
  const [filter, setFilter] = useState<SpellFilter>(EMPTY_SPELL_FILTER);
  const [copyRef, setCopyRef] = useState<Ref | null>(null);
  const Icon = CLASS_ICONS[iconId];
  const { mode } = block;

  const classList = useMemo(() => [...spells.values()].filter((s) => s.data.classes.includes(listId)), [spells, listId]);
  const tags = useMemo(
    () => [...new Set(classList.flatMap((s) => s.data.tags))].sort((a, b) => a.localeCompare(b, "es")),
    [classList],
  );

  const prepared = new Set(block.prepared.map(refKey));
  const always = new Map(block.always.map((a) => [refKey(a.spell.ref), a.origin]));
  const book = new Set(block.spellbook.map((s) => refKey(s.ref)));
  const count = block.prepared.length;
  const full = count >= block.preparedLimit;
  // Sin progresión de preparados (homebrew incompleto) no se puede preparar
  const canPrepare = isOwner && mode !== "levelUp" && block.preparedLimit > 0;
  const fullNotice = preparedFullNotice(count, block.preparedLimit);

  // Casilla de preparar: solo conjuros de nivel 1 o más que la clase puede preparar (en el Mago, los de su libro)
  function check(ref: Ref, spell: SpellOption | null): SpellRowItem["check"] {
    const key = refKey(ref);
    if (!canPrepare || !spell || spell.data.level < 1 || spell.data.level > block.maxSpellLevel) return undefined;
    if (always.has(key)) return { checked: true, disabled: true, reason: "Siempre preparado", onChange: () => {} };
    if (mode === "spellbook" && !book.has(key)) return undefined;
    const checked = prepared.has(key);
    return {
      checked,
      disabled: busy || (!checked && full),
      reason: !checked && full ? fullNotice : undefined,
      onChange: () => void onOp({ op: checked ? "unprepare" : "prepare", class: block.class, ref }),
    };
  }

  const item = (ref: Ref, name?: string, extra: Partial<SpellRowItem> = {}): SpellRowItem => {
    const spell = spells.get(refKey(ref)) ?? null;
    return { ref, name: name ?? spell?.nameEs ?? spell?.name ?? bareName(ref.key), spell, check: check(ref, spell), ...extra };
  };

  const cantrips = block.cantrips.map((c) => item(c.ref, c.name)).sort(byLevelAndName);
  const preparedItems = (mode === "levelUp" ? block.known.map((k) => item(k.ref, k.name)) : block.prepared.map((r) => item(r)))
    .sort(byLevelAndName);
  const alwaysItems = block.always.map((a) => item(a.spell.ref, a.spell.name, { origin: a.origin })).sort(byLevelAndName);

  const filtered = classList.filter((s) => matchesSpellFilter(s, filter));
  const available = filtered.filter((s) => s.data.level <= block.maxSpellLevel).map((s) => item(s.ref));
  const all = filtered.map((s) => item(s.ref, undefined, { dimmed: s.data.level > block.maxSpellLevel }));

  // Conjuros que el Mago puede copiar a su libro: de su lista, de nivel 1 hasta el máximo y que no tenga ya
  const copyable = mode === "spellbook" && isOwner
    ? classList.filter((s) => s.data.level >= 1 && s.data.level <= block.maxSpellLevel && !book.has(refKey(s.ref)))
    : [];

  async function copy() {
    if (!copyRef) return;
    if (await onOp({ op: "copy", ref: copyRef })) setCopyRef(null);
  }

  const tabs: { id: ListTab; label: string }[] = [
    { id: "preparados", label: "Preparados" },
    ...(mode !== "list" ? [{ id: "libro" as const, label: mode === "spellbook" ? "Mi libro" : "Mi lista" }] : []),
    { id: "disponibles", label: "Disponibles" },
    { id: "todos", label: "Todos" },
  ];
  const tabId = (t: ListTab) => `${refKey(block.class)}-${t}`.replace(/[^\w-]/g, "_");

  return (
    <section className={`${card} animate-fade-up`} aria-labelledby={`${tabId("preparados")}-title`}>
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-surface text-brand-soft">
          {Icon ? <Icon size={32} /> : <WandSparkles size={24} aria-hidden="true" />}
        </span>
        <h3 id={`${tabId("preparados")}-title`} className="font-heading text-xl font-bold">{block.name}</h3>
      </div>

      <dl className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Característica" value={ABILITY_NAMES[block.ability]} />
        <Stat label="CD de salvación" value={String(block.dc)} />
        <Stat label="Ataque" value={signed(block.attack)} />
        <Stat
          label={mode === "levelUp" ? "Aprendidos" : "Preparados"}
          value={`${mode === "levelUp" ? block.known.length : count}/${block.preparedLimit}`}
        />
        {(block.cantripLimit > 0 || block.cantrips.length > 0) && (
          <Stat label="Trucos" value={`${block.cantrips.length}/${block.cantripLimit}`} />
        )}
      </dl>

      <div role="tablist" aria-label={`Listas de ${block.name}`} className="mb-4 flex gap-1 overflow-x-auto border-b border-line print:hidden">
        {tabs.map((t) => (
          <button
            key={t.id}
            id={tabId(t.id)}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`${tabId(t.id)}-panel`}
            onClick={() => setTab(t.id)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
              tab === t.id ? "border-brand text-white" : "border-transparent text-muted hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id={`${tabId(tab)}-panel`} role="tabpanel" aria-labelledby={tabId(tab)} className="animate-fade-in" key={tab}>
        {canPrepare && full && (
          <p role="status" className="mb-3 rounded-md border border-line bg-surface px-3 py-2 text-sm text-muted">{fullNotice}</p>
        )}

        {tab === "preparados" && (
          <div className="space-y-4">
            {cantrips.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-wide text-muted">Trucos</h4>
                <SpellList items={cantrips} empty="" onOpen={onOpen} />
              </div>
            )}
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wide text-muted">
                {mode === "levelUp" ? "Aprendidos" : "Preparados"}
              </h4>
              <SpellList
                items={preparedItems}
                empty={mode === "levelUp" ? "Sin conjuros aprendidos." : "Aún no has preparado ningún conjuro."}
                onOpen={onOpen}
              />
            </div>
            {alwaysItems.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-wide text-muted">Siempre preparados</h4>
                <SpellList items={alwaysItems} empty="" onOpen={onOpen} />
              </div>
            )}
          </div>
        )}

        {tab === "libro" && (
          <>
            {copyable.length > 0 && (
              <div className="mb-4 flex flex-wrap items-end gap-2 rounded-md border border-line bg-surface p-3 print:hidden">
                <div className="min-w-0 flex-1 basis-56">
                  <RuleSelect
                    id={`${tabId("libro")}-copy`}
                    label="Copiar conjuro al libro"
                    options={copyable}
                    value={copyRef}
                    onChange={setCopyRef}
                    placeholder="Busca un conjuro de tu lista"
                  />
                </div>
                <button type="button" onClick={copy} disabled={!copyRef || busy} className={primaryButton}>
                  {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <BookPlus size={16} aria-hidden="true" />}
                  Copiar
                </button>
              </div>
            )}
            <SpellList
              items={(mode === "spellbook"
                ? block.spellbook.map((s) => item(s.ref, s.name))
                : [...cantrips, ...preparedItems]).sort(byLevelAndName)}
              empty={mode === "spellbook" ? "Tu libro de conjuros está vacío." : "Sin conjuros aprendidos."}
              onOpen={onOpen}
            />
          </>
        )}

        {(tab === "disponibles" || tab === "todos") && (
          <>
            <SpellFilters id={tabId(tab)} value={filter} onChange={setFilter} tags={tags} />
            <p className="mb-1 text-xs text-muted" aria-live="polite">
              {(tab === "disponibles" ? available : all).length} conjuros
            </p>
            <SpellList
              items={tab === "disponibles" ? available : all}
              empty={classList.length === 0 ? "No hay conjuros de esta clase en los libros del personaje." : "Ningún conjuro coincide con los filtros."}
              onOpen={onOpen}
            />
          </>
        )}
      </div>
    </section>
  );
}
