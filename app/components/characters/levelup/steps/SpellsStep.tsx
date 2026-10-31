"use client";

import { useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import type { SpellOption } from "@/lib/rules/catalog/types";
import { bareName, refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import { spellListName } from "@/lib/rules/dnd2024/sheet/labels";
import type { PendingChoice } from "@/lib/rules/dnd2024/levels/pendingChoices";
import type { Named } from "@/lib/rules/dnd2024/sheet/sheet";
import { EMPTY_SPELL_FILTER, matchesSpellFilter, type SpellFilter } from "@/lib/rules/dnd2024/spells/spellFilters";
import { classSpellOptions, type SpellPick, type SwapPick } from "@/lib/rules/dnd2024/spells/spellPicks";
import { spellSchoolName } from "@/lib/rules/dnd2024/spells/spellTextClient";
import type { Ref, SpellcastingMode } from "@/lib/rules/types";
import { field, labelClass } from "@/app/components/ui/formStyles";
import RuleSelect from "../../creator/RuleSelect";
import type { GrantedSpell } from "@/lib/rules/dnd2024/spells/grantedSpells";
import SpellDialog from "../../spells/SpellDialog";
import SpellFilters from "../../spells/SpellFilters";
import SpellList, { type SpellOpener, type SpellRowItem } from "../../spells/SpellList";

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
  /** Elección de conjuros del nivel; sin ella (clase sin elección en este nivel), solo se muestran los que ya tiene. */
  pending: PendingChoice | null;
  /** Conjuros de los libros (se filtran por la lista de la clase). */
  spells: SpellOption[];
  /** Trucos y conjuros que ya tiene (aprendidos o su libro): marcados e inactivos, y de ahí sale el que se sustituye. */
  held: { cantrips: Named[]; spells: Named[] };
  /** Conjuros que ya tiene por otras vías (siempre preparados, especie, legado, dotes; `libro:clave`): no se eligen. */
  granted?: GrantedSpell[];
  value: SpellPick;
  onChange: (value: SpellPick) => void;
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
   truco y de un conjuro aprendido. Con Secretos mágicos, los conjuros (no los trucos) también de otras listas, con un
   filtro por lista; con el Sabio de la escuela, las entradas gratis de su escuela aparte. */
export default function SpellsStep(props: Props) {
  const { id, mode, maxLevel, pending, held, value, onChange } = props;
  const [filter, setFilter] = useState<SpellFilter>(EMPTY_SPELL_FILTER);
  const [listFilter, setListFilter] = useState("");
  const opener = useRef<HTMLElement | null>(null);

  const byKey = useMemo(() => new Map(props.spells.map((s) => [refKey(s.ref), s])), [props.spells]);
  const accepts = props.accepts?.test;
  // Secretos mágicos: los conjuros de nivel 1 o más, de cualquiera de sus listas
  const extraLists = pending?.spells?.lists;
  const list = useMemo(
    () => classSpellOptions(props.spells, { listId: props.listId, maxLevel, extraLists, accepts }),
    [props.spells, props.listId, maxLevel, accepts, extraLists],
  );
  const tags = useMemo(() => [...new Set(list.flatMap((s) => s.data.tags))].sort((a, b) => a.localeCompare(b, "es")), [list]);

  const counts = pending?.spells ?? { cantrips: 0, spells: 0 };
  const picked = { cantrips: value.cantrips.slice(0, counts.cantrips), spells: value.spells.slice(0, counts.spells) };
  // Sabio de la escuela: entradas gratis de su escuela (de 0 a `count`)
  const free = pending?.spells?.free;
  const freePicked = free ? (value.free ?? []).slice(0, free.count) : [];
  const granted = new Map((props.granted ?? []).map((g) => [g.key, g.label]));
  const heldKeys = new Set([...held.cantrips, ...held.spells].map((h) => refKey(h.ref)).concat([...granted.keys()]));
  // De dónde viene lo que ya tiene: otra vía («Ya lo tienes») u otra elección («Ya lo eliges con la clase»)
  const grantedText = (key: string) => (granted.get(key) ? `Ya lo eliges con ${granted.get(key)}` : "Ya lo tienes");
  const heldLabel = (s: SpellOption) => (granted.has(refKey(s.ref)) ? grantedText(refKey(s.ref))
    : mode === "spellbook" && s.data.level > 0 ? "Ya está en tu libro" : "Ya lo conoces");
  const swapIns = [value.replace.in, value.replaceCantrip.in].filter(Boolean);
  const freeSet = new Set(freePicked);

  function toggle(kind: "cantrips" | "spells", key: string) {
    const current = picked[kind];
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    onChange({ ...value, [kind]: next });
  }

  // Casilla de aprender (trucos y conjuros nuevos o entradas del libro)
  function learnCheck(s: SpellOption): SpellRowItem["check"] {
    const key = refKey(s.ref);
    const cantrip = s.data.level === 0;
    const count = cantrip ? counts.cantrips : counts.spells;
    if (count === 0) return undefined;
    const kind = cantrip ? "cantrips" : "spells";
    const checked = picked[kind].includes(key);
    const isHeld = heldKeys.has(key);
    const reason = isHeld && !checked ? heldLabel(s)
      : swapIns.includes(key) ? "Ya lo eliges como sustituto"
      : freeSet.has(key) ? "Ya lo eliges gratis"
      : !checked && picked[kind].length >= count ? `Ya has elegido ${count}. Desmarca uno para elegir otro`
      : undefined;
    return {
      checked: checked || isHeld, disabled: !!reason, reason,
      label: `${checked ? "Quitar" : "Elegir"} ${nameOf(s)}`,
      onChange: () => toggle(kind, key),
    };
  }
  const item = (s: SpellOption, check: SpellRowItem["check"]): SpellRowItem => ({
    ref: s.ref, name: nameOf(s), spell: s, check,
  });
  const rowOf = (s: SpellOption) => {
    const check = learnCheck(s);
    // Sin casilla, los que ya tiene llevan la marca
    if (!check && heldKeys.has(refKey(s.ref)))
      return { ...item(s, undefined), origin: granted.has(refKey(s.ref)) ? grantedText(refKey(s.ref))
        : mode === "spellbook" && s.data.level > 0 ? "En tu libro" : "Ya lo conoces" };
    return item(s, check);
  };

  // Casilla de las entradas gratis del Sabio de la escuela
  function freeCheck(s: SpellOption): SpellRowItem["check"] {
    const key = refKey(s.ref);
    const checked = freeSet.has(key);
    const reason = heldKeys.has(key) && !checked ? heldLabel(s)
      : picked.spells.includes(key) ? "Ya lo eliges para tu libro"
      : swapIns.includes(key) ? "Ya lo eliges como sustituto"
      : !checked && free && freePicked.length >= free.count ? `Ya has elegido ${free.count}. Desmarca uno para elegir otro`
      : undefined;
    return {
      checked: checked || heldKeys.has(key), disabled: !!reason, reason,
      label: `${checked ? "Quitar" : "Añadir gratis"} ${nameOf(s)}`,
      onChange: () => onChange({ ...value, free: checked ? freePicked.filter((k) => k !== key) : [...freePicked, key] }),
    };
  }
  const freeOptions = free
    ? list.filter((s) => s.data.school === free.school && s.data.level >= 1 && s.data.level <= free.maxLevel)
      .map((s) => item(s, freeCheck(s)))
    : [];

  const spellsOf = (keys: string[]) => keys.map((k) => byKey.get(k)).filter((s): s is SpellOption => !!s);
  const chosen = spellsOf([...picked.cantrips, ...picked.spells])
    .sort(byLevelAndName).map(rowOf)
    .concat(spellsOf(freePicked).sort(byLevelAndName).map((s) => ({ ...item(s, freeCheck(s)), origin: "Gratis" })));
  const filtered = list.filter((s) => matchesSpellFilter(s, filter)
    && (!listFilter || s.data.classes.includes(listFilter))).map(rowOf);

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
    ...(free ? [{
      label: `Gratis de ${spellSchoolName(free.school)} (hasta ${free.count})`, done: freePicked.length === free.count,
      value: `${freePicked.length}/${free.count}`,
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

      {chosen.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Elegidos</h3>
          <SpellList items={chosen} empty="" onOpen={open} href={spellUrl} />
        </div>
      )}

      {free && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Gratis en tu libro ({spellSchoolName(free.school)})
          </h3>
          <p className="mt-1 text-xs text-muted">
            Puedes añadir hasta {plural(free.count, "conjuro", "conjuros")} de {spellSchoolName(free.school)}{" "}
            {levels(free.maxLevel)} a tu libro, además de los de este nivel.
          </p>
          <SpellList items={freeOptions} empty="No hay conjuros de esta escuela en los libros del personaje." onOpen={open} href={spellUrl} />
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
          {props.accepts?.title ?? (extraLists ? "Listas de conjuros" : `Lista de ${props.casterName}`)}
        </h3>
        {extraLists && (
          <div className="mb-3 max-w-xs">
            <label htmlFor={`${id}-list`} className={labelClass}>Lista</label>
            <select id={`${id}-list`} className={field} value={listFilter} onChange={(e) => setListFilter(e.target.value)}>
              <option value="">Todas (trucos solo de {props.casterName})</option>
              {extraLists.map((l) => <option key={l} value={l}>{spellListName(l)}</option>)}
            </select>
          </div>
        )}
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
