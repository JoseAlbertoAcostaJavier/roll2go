"use client";

import { useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import type { SpellOption } from "@/lib/rules/catalog";
import { bareName, refKey } from "@/lib/rules/dnd2024/equipmentRefs";
import type { PendingChoice } from "@/lib/rules/dnd2024/levels";
import type { Named } from "@/lib/rules/dnd2024/sheet";
import { EMPTY_SPELL_FILTER, matchesSpellFilter, type SpellFilter } from "@/lib/rules/dnd2024/spellFilters";
import type { SpellPick, SwapPick } from "@/lib/rules/dnd2024/spellPicks";
import type { Ref, SpellcastingMode } from "@/lib/rules/types";
import { field, labelClass } from "@/app/components/formStyles";
import RuleSelect from "../../RuleSelect";
import { preparedFullNotice } from "../../spells/CasterBlockView";
import SpellDialog from "../../spells/SpellDialog";
import SpellFilters from "../../spells/SpellFilters";
import SpellList, { type SpellOpener, type SpellRowItem } from "../../spells/SpellList";

/** Preparados iniciales en la creación (modos `list` y `spellbook`). */
export type PreparedPick = {
  limit: number;
  /** Marcados (`libro:clave`). */
  value: string[];
  /** Siempre preparados de la clase: no cuentan ni se marcan. */
  always: string[];
  onChange: (value: string[]) => void;
};

type Props = {
  /** Prefijo de los ids. */
  id: string;
  casterName: string;
  mode: SpellcastingMode;
  /** Lista de conjuros de la clase (`SpellData.classes`). */
  listId: string;
  /** En lugar de la lista de la clase, los que acepta (conjuros de una dote) y el título de la lista. */
  accepts?: { test: (s: SpellOption) => boolean; title: string };
  maxLevel: number;
  /** Elección de conjuros del nivel; sin ella (Paladín 1), solo se preparan. */
  pending: PendingChoice | null;
  /** Conjuros de los libros (se filtran por la lista de la clase). */
  spells: SpellOption[];
  /** Trucos y conjuros que ya tiene (aprendidos o su libro): marcados e inactivos, y de ahí sale el que se sustituye. */
  held: { cantrips: Named[]; spells: Named[] };
  /** Conjuros que ya tiene por otras vías (siempre preparados, especie, legado, dotes; `libro:clave`): no se eligen. */
  granted?: string[];
  value: SpellPick;
  onChange: (value: SpellPick) => void;
  prepared?: PreparedPick;
  /** Para pedir la ficha de un conjuro: con personaje, sus libros; sin él, los de la campaña. */
  characterId: string | null;
  campaignId: string | null;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const levels = (max: number) => (max <= 1 ? "de nivel 1" : `de nivel 1–${max}`);
const nameOf = (s: SpellOption) => s.nameEs ?? s.name;
const byLevelAndName = (a: SpellOption, b: SpellOption) => a.data.level - b.data.level || nameOf(a).localeCompare(nameOf(b), "es");

function Counter({ label, done, value }: { label: string; done: boolean; value: string }) {
  return (
    <li className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${done ? "border-brand bg-brand/10" : "border-line"}`}>
      {done && <Check size={14} aria-hidden="true" className="text-brand-soft" />}
      <span className="font-semibold">{label}</span>
      <span className="text-muted">{value}</span>
    </li>
  );
}

/* Elección de conjuros al subir de nivel y al crear el personaje (spec de conjuros §4.2 y §4.3): la lista de la clase
   con filtros en modo selección («Elige 1 truco», «Elige 2 conjuros de nivel 1–2»), las sustituciones opcionales de un
   truco y de un conjuro aprendido y, al crear, los preparados iniciales hasta el límite. */
export default function SpellsStep(props: Props) {
  const { id, mode, maxLevel, pending, held, value, onChange, prepared } = props;
  const [filter, setFilter] = useState<SpellFilter>(EMPTY_SPELL_FILTER);
  const opener = useRef<HTMLElement | null>(null);

  const byKey = useMemo(() => new Map(props.spells.map((s) => [refKey(s.ref), s])), [props.spells]);
  const accepts = props.accepts?.test;
  const list = useMemo(
    () => props.spells.filter((s) => (accepts ? accepts(s) : s.data.classes.includes(props.listId))).sort(byLevelAndName),
    [props.spells, props.listId, accepts],
  );
  const tags = useMemo(() => [...new Set(list.flatMap((s) => s.data.tags))].sort((a, b) => a.localeCompare(b, "es")), [list]);

  const counts = pending?.spells ?? { cantrips: 0, spells: 0 };
  const picked = { cantrips: value.cantrips.slice(0, counts.cantrips), spells: value.spells.slice(0, counts.spells) };
  const granted = new Set(props.granted ?? []);
  const heldKeys = new Set([...held.cantrips, ...held.spells].map((h) => refKey(h.ref)).concat([...granted]));
  const heldLabel = (s: SpellOption) => (granted.has(refKey(s.ref)) ? "Ya lo tienes"
    : mode === "spellbook" && s.data.level > 0 ? "Ya está en tu libro" : "Ya lo conoces");
  const swapIns = [value.replace.in, value.replaceCantrip.in].filter(Boolean);
  const prepSet = new Set(prepared?.value ?? []);
  const always = new Set(prepared?.always ?? []);
  const prepFull = !!prepared && prepared.value.length >= prepared.limit;
  const fullNotice = prepared ? preparedFullNotice(prepared.value.length, prepared.limit) : "";
  // En el Mago, solo se preparan los conjuros de su libro (los elegidos ahora)
  const preparable = (s: SpellOption) => !!prepared && s.data.level >= 1 && s.data.level <= maxLevel
    && (mode === "spellbook" ? picked.spells.includes(refKey(s.ref)) : mode === "list");

  function toggle(kind: "cantrips" | "spells", key: string) {
    const current = picked[kind];
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    onChange({ ...value, [kind]: next });
    // Un conjuro que sale del libro deja de estar preparado
    if (kind === "spells" && mode === "spellbook" && prepared && !next.includes(key) && prepSet.has(key))
      prepared.onChange(prepared.value.filter((k) => k !== key));
  }
  function togglePrepared(key: string) {
    if (!prepared) return;
    prepared.onChange(prepSet.has(key) ? prepared.value.filter((k) => k !== key) : [...prepared.value, key]);
  }

  // Casilla de aprender (trucos y conjuros nuevos o entradas del libro) o, en modo `list`, de preparar
  function learnCheck(s: SpellOption): SpellRowItem["check"] {
    const key = refKey(s.ref);
    const cantrip = s.data.level === 0;
    const count = cantrip ? counts.cantrips : counts.spells;
    if (count === 0) return undefined;
    const kind = cantrip ? "cantrips" : "spells";
    const checked = picked[kind].includes(key);
    const isHeld = heldKeys.has(key);
    const reason = isHeld ? heldLabel(s)
      : !cantrip && s.data.level > maxLevel ? `Nivel demasiado alto (hasta el ${maxLevel})`
      : swapIns.includes(key) ? "Ya lo eliges como sustituto"
      : !checked && picked[kind].length >= count ? `Ya has elegido ${count}. Desmarca uno para elegir otro`
      : undefined;
    return {
      checked: checked || isHeld, disabled: !!reason, reason,
      label: `${checked ? "Quitar" : "Elegir"} ${nameOf(s)}`,
      onChange: () => toggle(kind, key),
    };
  }
  function prepareCheck(s: SpellOption): SpellRowItem["check"] {
    const key = refKey(s.ref);
    if (always.has(key)) return { checked: true, disabled: true, reason: "Siempre preparado", onChange: () => {} };
    const checked = prepSet.has(key);
    const reason = !checked && prepFull ? fullNotice : undefined;
    return { checked, disabled: !!reason, reason, onChange: () => togglePrepared(key) };
  }
  const item = (s: SpellOption, check: SpellRowItem["check"]): SpellRowItem => ({
    ref: s.ref, name: nameOf(s), spell: s, check, dimmed: s.data.level > maxLevel,
  });
  const rowOf = (s: SpellOption) => {
    const check = learnCheck(s) ?? (mode === "list" && preparable(s) ? prepareCheck(s) : undefined);
    // Sin casilla, los que ya tiene llevan la marca
    if (!check && heldKeys.has(refKey(s.ref)))
      return { ...item(s, undefined), origin: granted.has(refKey(s.ref)) ? "Ya lo tienes"
        : mode === "spellbook" && s.data.level > 0 ? "En tu libro" : "Ya lo conoces" };
    return item(s, check);
  };

  const spellsOf = (keys: string[]) => keys.map((k) => byKey.get(k)).filter((s): s is SpellOption => !!s);
  const chosen = spellsOf([...picked.cantrips, ...picked.spells, ...(mode === "list" ? (prepared?.value ?? []) : [])])
    .sort(byLevelAndName).map(rowOf);
  const book = mode === "spellbook" && prepared ? spellsOf(picked.spells).sort(byLevelAndName).map((s) => item(s, prepareCheck(s))) : [];
  const filtered = list.filter((s) => matchesSpellFilter(s, filter)).map(rowOf);

  // Sustituciones: un truco y (en `levelUp`) un conjuro aprendido
  const swaps = [
    { field: "replaceCantrip" as const, allowed: !!pending?.optionalReplaceCantrip, cantrip: true, from: held.cantrips },
    { field: "replace" as const, allowed: !!pending?.optionalReplace && mode === "levelUp", cantrip: false, from: held.spells },
  ].filter((s) => s.allowed && s.from.length > 0);
  const setSwap = (f: "replace" | "replaceCantrip", v: SwapPick) => onChange({ ...value, [f]: v });

  // Abre la ficha del conjuro: añade `?spell=` a la dirección sin perder el resto
  const spellUrl = (ref: Ref) => {
    const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
    params.set("spell", refKey(ref));
    return `?${params.toString()}`;
  };
  const open: SpellOpener = (ref, from) => {
    opener.current = from;
    window.history.pushState(null, "", spellUrl(ref));
  };

  const counters = [
    ...(counts.cantrips > 0 ? [{
      label: `Elige ${plural(counts.cantrips, "truco", "trucos")}`, done: picked.cantrips.length === counts.cantrips,
      value: `${picked.cantrips.length}/${counts.cantrips}`,
    }] : []),
    ...(counts.spells > 0 ? [{
      label: `Elige ${plural(counts.spells, "conjuro", "conjuros")} ${levels(maxLevel)}${mode === "spellbook" ? " para tu libro" : ""}`,
      done: picked.spells.length === counts.spells, value: `${picked.spells.length}/${counts.spells}`,
    }] : []),
    ...(prepared && prepared.limit > 0 ? [{
      label: `Prepara hasta ${plural(prepared.limit, "conjuro", "conjuros")}`, done: prepFull,
      value: `${prepared.value.length}/${prepared.limit}`,
    }] : []),
  ];

  return (
    <div className="min-w-0 space-y-5">
      {counters.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Lo que eliges">
          {counters.map((c) => <Counter key={c.label} {...c} />)}
        </ul>
      ) : (
        <p className="text-sm text-muted">Este nivel no da conjuros nuevos, pero puedes sustituir uno de los que conoces.</p>
      )}
      {prepared && prepared.limit > 0 && (
        <p className="text-xs text-muted">
          {mode === "spellbook"
            ? "Prepara conjuros de tu libro; podrás cambiarlos en la ficha."
            : "Prepara conjuros de la lista de tu clase; podrás cambiarlos en la ficha."}
        </p>
      )}

      {chosen.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Elegidos</h3>
          <SpellList items={chosen} empty="" onOpen={open} href={spellUrl} />
        </div>
      )}

      {book.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Preparados de tu libro</h3>
          {prepFull && <p role="status" className="mt-1 text-xs text-muted">{fullNotice}</p>}
          <SpellList items={book} empty="" onOpen={open} href={spellUrl} />
        </div>
      )}

      {swaps.map((s) => {
        const pick = value[s.field];
        const what = s.cantrip ? "truco" : "conjuro";
        const taken = new Set([...heldKeys, ...picked.cantrips, ...picked.spells, ...swapIns.filter((k) => k !== pick.in)]);
        const options = list.filter((o) => (s.cantrip ? o.data.level === 0 : o.data.level >= 1 && o.data.level <= maxLevel)
          && !taken.has(refKey(o.ref)));
        const outId = `${id}-${s.field}-out`;
        return (
          <fieldset key={s.field} className="space-y-3 rounded-md border border-line p-3">
            <legend className="px-1 text-sm font-semibold">
              Puedes sustituir un {what} que ya conoces <span className="font-normal text-muted">· opcional</span>
            </legend>
            <div>
              <label htmlFor={outId} className={labelClass}>Sale</label>
              <select
                id={outId}
                className={field}
                value={pick.out}
                onChange={(e) => setSwap(s.field, { out: e.target.value, in: e.target.value ? pick.in : "" })}
              >
                <option value="">No sustituir</option>
                {s.from.map((h) => {
                  const k = refKey(h.ref);
                  const spell = byKey.get(k);
                  return <option key={k} value={k}>{spell ? nameOf(spell) : h.name || bareName(h.ref.key)}</option>;
                })}
              </select>
            </div>
            {pick.out && (
              <div className="animate-fade-in">
                <RuleSelect
                  id={`${id}-${s.field}-in`}
                  label="Entra"
                  options={options}
                  value={pick.in ? (byKey.get(pick.in)?.ref ?? null) : null}
                  onChange={(r) => setSwap(s.field, { ...pick, in: r ? refKey(r) : "" })}
                  placeholder={`Busca un ${what} de tu lista`}
                />
              </div>
            )}
          </fieldset>
        );
      })}

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          {props.accepts?.title ?? `Lista de ${props.casterName}`}
        </h3>
        <SpellFilters id={`${id}-filters`} value={filter} onChange={setFilter} tags={tags} />
        <p className="mb-1 text-xs text-muted" aria-live="polite">{filtered.length} conjuros</p>
        <SpellList
          items={filtered}
          empty={list.length === 0
            ? `No hay conjuros ${props.accepts ? "para elegir" : "de esta clase"} en los libros del personaje.`
            : "Ningún conjuro coincide con los filtros."}
          onOpen={open}
          href={spellUrl}
        />
      </div>

      <SpellDialog characterId={props.characterId} campaignId={props.campaignId} spells={byKey} opener={opener} />
    </div>
  );
}
