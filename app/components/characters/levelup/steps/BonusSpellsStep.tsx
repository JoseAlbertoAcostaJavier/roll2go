"use client";

import { useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import type { SpellOption } from "@/lib/rules/catalog";
import { bareName, refKey } from "@/lib/rules/dnd2024/equipmentRefs";
import { spellListName } from "@/lib/rules/dnd2024/labels";
import type { PendingChoice } from "@/lib/rules/dnd2024/levels";
import type { Named } from "@/lib/rules/dnd2024/sheet";
import { EMPTY_SPELL_FILTER, matchesSpellFilter, type SpellFilter } from "@/lib/rules/dnd2024/spellFilters";
import type { SpellPick } from "@/lib/rules/dnd2024/spellPicks";
import type { Ref } from "@/lib/rules/types";
import { field, labelClass } from "@/app/components/formStyles";
import RuleSelect from "../../RuleSelect";
import SpellDialog from "../../spells/SpellDialog";
import SpellFilters from "../../spells/SpellFilters";
import SpellList, { type SpellOpener, type SpellRowItem } from "../../spells/SpellList";

type Props = {
  id: string;
  /** Elección `arcanum` (Arcano místico) o `bonusSpells` (Descubrimientos mágicos, Ilusiones mejoradas, Distintivos). */
  p: PendingChoice;
  spells: SpellOption[];
  /** Los que ya da esta elección (los arcanos de la clase o los del rasgo): de ahí sale el que se sustituye. */
  held: Named[];
  /** Libro de la clase con lo elegido en este nivel (`libro:clave`), para los que se eligen de él. */
  spellbook: string[];
  /** Conjuros que ya tiene por cualquier vía (`libro:clave`): no se eligen (salvo los del libro, si se eligen de él). */
  taken: string[];
  value: SpellPick;
  onChange: (value: SpellPick) => void;
  characterId: string;
  campaignId: string | null;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const nameOf = (s: SpellOption) => s.nameEs ?? s.name;
const byLevelAndName = (a: SpellOption, b: SpellOption) => a.data.level - b.data.level || nameOf(a).localeCompare(nameOf(b), "es");

// De dónde se eligen: el texto del contador («Elige 1 truco de la lista de Mago», «Elige 2 conjuros de nivel 3 de tu
// libro»), con el nombre en singular y plural, y la prueba de cada conjuro (sin contar los que ya tiene)
function rules(p: PendingChoice, spellbook: Set<string>) {
  if (p.arcanum) {
    const { list, level } = p.arcanum;
    return {
      noun: ["conjuro", "conjuros"],
      what: level ? `de nivel ${level} de la lista de ${spellListName(list)}` : "",
      fits: (s: SpellOption, at = level) => s.data.classes.includes(list) && s.data.level === at,
    };
  }
  const b = p.bonusSpells!;
  const from = b.fromSpellbook ? "de tu libro"
    : b.lists.length === 1 ? `de la lista de ${spellListName(b.lists[0])}`
    : `de las listas de ${new Intl.ListFormat("es", { type: "disjunction" }).format(b.lists.map(spellListName))}`;
  const levels = b.cantripsOnly ? "" : b.level !== undefined ? `de nivel ${b.level}`
    : b.maxLevel !== undefined ? `(trucos o de nivel 1–${b.maxLevel})` : "";
  return {
    noun: b.cantripsOnly ? ["truco", "trucos"] : ["conjuro", "conjuros"],
    what: `${levels} ${from}`.trim(),
    fits: (s: SpellOption, at?: number) => (b.fromSpellbook ? spellbook.has(refKey(s.ref)) : s.data.classes.some((c) => b.lists.includes(c)))
      && (!b.cantripsOnly || s.data.level === 0)
      && (b.level === undefined || s.data.level === b.level)
      && (b.maxLevel === undefined || s.data.level <= b.maxLevel)
      && (at === undefined || s.data.level === at),
  };
}

/* Conjuros que no cuentan para los límites (spec de ampliación §2.2–§2.7): el Arcano místico del nivel y los de los
   rasgos (Descubrimientos mágicos, Ilusiones mejoradas, Conjuros distintivos), en modo selección («Elige 2 conjuros…»),
   y la sustitución opcional de uno de los que ya da la elección por otro que cumpla lo mismo. */
export default function BonusSpellsStep({ id, p, spells, held, spellbook, taken, value, onChange, characterId, campaignId }: Props) {
  const [filter, setFilter] = useState<SpellFilter>(EMPTY_SPELL_FILTER);
  const opener = useRef<HTMLElement | null>(null);
  const byKey = useMemo(() => new Map(spells.map((s) => [refKey(s.ref), s])), [spells]);
  const book = useMemo(() => new Set(spellbook), [spellbook]);
  const { noun, what, fits } = rules(p, book);
  // Los del libro se pueden elegir aunque ya los tenga; los demás, no
  const fromBook = !!p.bonusSpells?.fromSpellbook;
  const heldKeys = new Set(held.map((h) => refKey(h.ref)));
  const blocked = new Set([...heldKeys, ...(fromBook ? [] : taken)]);

  const list = p.count > 0 ? spells.filter((s) => fits(s)).sort(byLevelAndName) : [];
  const tags = [...new Set(list.flatMap((s) => s.data.tags))].sort((x, y) => x.localeCompare(y, "es"));
  const picked = value.spells.slice(0, p.count);
  const swapIn = p.optionalReplace ? value.replace.in : "";

  function check(s: SpellOption): SpellRowItem["check"] {
    const key = refKey(s.ref);
    const checked = picked.includes(key);
    const isBlocked = blocked.has(key);
    const reason = isBlocked ? (heldKeys.has(key) ? "Ya lo tienes por este rasgo" : "Ya lo tienes")
      : key === swapIn ? "Ya lo eliges como sustituto"
      : !checked && picked.length >= p.count ? `Ya has elegido ${p.count}. Desmarca uno para elegir otro`
      : undefined;
    return {
      checked: checked || isBlocked, disabled: !!reason, reason,
      label: `${checked ? "Quitar" : "Elegir"} ${nameOf(s)}`,
      onChange: () => onChange({ ...value, spells: checked ? picked.filter((k) => k !== key) : [...picked, key] }),
    };
  }
  const row = (s: SpellOption): SpellRowItem => ({ ref: s.ref, name: nameOf(s), spell: s, check: check(s) });
  const chosen = picked.map((k) => byKey.get(k)).filter((s): s is SpellOption => !!s).sort(byLevelAndName).map(row);
  const filtered = list.filter((s) => matchesSpellFilter(s, filter)).map(row);

  // Sustitución: uno de los que ya da la elección por otro que cumpla lo mismo (el arcano, del mismo nivel)
  const swap = value.replace;
  const outSpell = swap.out ? byKey.get(swap.out) : undefined;
  const swapOptions = p.optionalReplace && swap.out && (outSpell || !p.arcanum)
    ? spells.filter((s) => fits(s, p.arcanum ? outSpell?.data.level : undefined) && !blocked.has(refKey(s.ref))
      && !picked.includes(refKey(s.ref))).sort(byLevelAndName)
    : [];
  const setSwap = (out: string, inKey: string) => onChange({ ...value, replace: { out, in: inKey } });

  const spellUrl = (ref: Ref) => {
    const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
    params.set("spell", refKey(ref));
    return `?${params.toString()}`;
  };
  const open: SpellOpener = (ref, from) => {
    opener.current = from;
    window.history.pushState(null, "", spellUrl(ref));
  };

  return (
    <div className="min-w-0 space-y-5">
      {p.count > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Lo que eliges">
          <li className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${picked.length === p.count ? "border-brand bg-brand/10" : "border-line"}`}>
            {picked.length === p.count && <Check size={14} aria-hidden="true" className="text-brand-soft" />}
            <span className="font-semibold">Elige {plural(p.count, noun[0], noun[1])} {what}</span>
            <span className="text-muted">{picked.length}/{p.count}</span>
          </li>
        </ul>
      ) : (
        <p className="text-sm text-muted">
          Este nivel no da conjuros nuevos de {p.label}{held.length > 0 ? ", pero puedes sustituir uno de los que tienes" : ""}.
        </p>
      )}
      <p className="text-xs text-muted">
        {p.arcanum ? "Lo lanzas una vez sin gastar espacio y lo recuperas con un descanso largo."
          : "Siempre preparados: no cuentan para tu límite de conjuros."}
      </p>

      {chosen.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Elegidos</h3>
          <SpellList items={chosen} empty="" onOpen={open} href={spellUrl} />
        </div>
      )}

      {p.optionalReplace && held.length > 0 && (
        <fieldset className="space-y-3 rounded-md border border-line p-3">
          <legend className="px-1 text-sm font-semibold">
            Puedes sustituir uno de los que tienes <span className="font-normal text-muted">· opcional</span>
          </legend>
          <div>
            <label htmlFor={`${id}-out`} className={labelClass}>Sale</label>
            <select id={`${id}-out`} className={field} value={swap.out} onChange={(e) => setSwap(e.target.value, "")}>
              <option value="">No sustituir</option>
              {held.map((h) => {
                const k = refKey(h.ref);
                const s = byKey.get(k);
                return <option key={k} value={k}>{s ? nameOf(s) : h.name || bareName(h.ref.key)}</option>;
              })}
            </select>
          </div>
          {swap.out && (
            <div className="animate-fade-in">
              <RuleSelect
                id={`${id}-in`}
                label="Entra"
                options={swapOptions}
                value={swap.in ? (byKey.get(swap.in)?.ref ?? null) : null}
                onChange={(r) => setSwap(swap.out, r ? refKey(r) : "")}
                placeholder="Busca un conjuro del mismo nivel"
              />
            </div>
          )}
        </fieldset>
      )}

      {p.count > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Conjuros que puedes elegir</h3>
          <SpellFilters id={`${id}-filters`} value={filter} onChange={setFilter} tags={tags} />
          <p className="mb-1 text-xs text-muted" aria-live="polite">{filtered.length} conjuros</p>
          <SpellList
            items={filtered}
            empty={list.length === 0 ? "No hay conjuros para elegir en los libros del personaje." : "Ningún conjuro coincide con los filtros."}
            onOpen={open}
            href={spellUrl}
          />
        </div>
      )}

      <SpellDialog characterId={characterId} campaignId={campaignId} spells={byKey} opener={opener} />
    </div>
  );
}
