"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Slots } from "@/lib/rules/dnd2024/derive";
import { PACT_SLOT } from "@/lib/rules/dnd2024/spells/spellOps";
import type { CastOption } from "@/lib/rules/dnd2024/spells/castOptions";
import { castOptions } from "@/lib/rules/dnd2024/spells/castOptions";
import type { SpellRow } from "@/lib/rules/dnd2024/spells/spellTable";
import { groupByLevel, matchesSpellTable, type SpellTableFilter } from "@/lib/rules/dnd2024/spells/spellTableFilter";
import { iconSrc } from "@/lib/utils/icons";
import { sheetCard } from "@/app/components/ui/formStyles";
import MaskIcon from "@/app/components/ui/MaskIcon";
import CastButton from "./CastButton";
import { Uses } from "./LimitedUses";
import SpellSlotBoxes from "./SpellSlotBoxes";
import { spellHrefFrom, type SpellOpener } from "./SpellList";

type Props = {
  /** Todas las filas: el filtro solo decide qué se ve en pantalla, la hoja impresa sale completa. */
  rows: SpellRow[];
  filter: SpellTableFilter;
  slots: Slots;
  /** Espacios gastados por nivel ("1".."9" y "pact"). */
  used: Record<string, number>;
  /** Usos gastados de los conjuros limitados, por clave. */
  limitedUsed: Record<string, number>;
  /** Solo el dueño lanza y marca casillas. */
  isOwner: boolean;
  busy: boolean;
  onCast: (row: SpellRow, option: CastOption) => void;
  onSetSlot: (level: string, used: number) => void;
  onSetLimited: (key: string, used: number) => void;
  onOpen: SpellOpener;
  /** Dirección que quita todos los filtros. */
  clearHref: string;
};

const th = "px-3 py-2 font-semibold";
const td = "px-3 py-2 align-top";
// Lo que el filtro oculta en pantalla sigue en el documento y sale al imprimir
const hideRow = (visible: boolean) => (visible ? "" : "hidden print:table-row");

function Flag({ letter, title }: { letter: string; title: string }) {
  return (
    <abbr title={title} className="rounded border border-line px-1 text-[11px] font-semibold text-muted no-underline">
      {letter}
      <span className="sr-only"> ({title})</span>
    </abbr>
  );
}

function Row({ row, visible, props, search }: { row: SpellRow; visible: boolean; props: Props; search: string }) {
  const { slots, used, isOwner, busy } = props;
  const limitedUsed = row.limited ? (props.limitedUsed[row.limited.key] ?? row.limited.used) : 0;
  // (con los usos gastados al momento, no los de la carga de la página)
  const options = castOptions(row.limited ? { ...row, limited: { ...row.limited, used: limitedUsed } } : row, slots, used);
  const uses = row.limited && (
    <Uses
      item={{
        key: row.limited.key, spell: { ref: row.ref, name: row.name }, origin: row.origin,
        max: row.limited.max, used: limitedUsed,
      }}
      onSet={isOwner ? props.onSetLimited : null}
      busy={busy}
    />
  );
  return (
    <tr className={hideRow(visible)}>
      {/* Quien no es el dueño no lanza: sin columna, y los usos (solo lectura) van bajo el nombre */}
      {isOwner && (
        <td className={`${td} print:hidden`}>
          <span className="flex flex-wrap items-center gap-2">
            {row.level > 0 && (
              <CastButton options={options} disabled={busy} name={row.name} onCast={(o) => props.onCast(row, o)} />
            )}
            {uses}
          </span>
        </td>
      )}
      <th scope="row" className={`${td} text-left`}>
        <span className="flex items-start gap-2">
          <MaskIcon src={iconSrc("darkSchool", row.schoolId)} size={18} label={row.school} className="mt-0.5 text-muted" />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <a
                href={spellHrefFrom(search, row.ref)}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  e.preventDefault();
                  props.onOpen(row.ref, e.currentTarget);
                }}
                className="font-semibold text-fg hover:text-brand-soft hover:underline"
              >
                {row.name}
              </a>
              {row.concentration && <Flag letter="C" title="Concentración" />}
              {row.ritual && <Flag letter="R" title="Ritual" />}
            </span>
            <span className="block text-xs font-normal text-muted">{row.origin}</span>
            {row.limited && (
              <>
                {!isOwner && <span className="mt-1 block print:hidden">{uses}</span>}
                {/* Las casillas no salen al imprimir: los usos quedan en texto */}
                <span className="hidden text-xs font-normal text-muted print:block">
                  Usos disponibles: {row.limited.max - Math.min(limitedUsed, row.limited.max)}/{row.limited.max}
                </span>
              </>
            )}
          </span>
        </span>
      </th>
      <td className={`${td} whitespace-nowrap`}>
        <span title={row.time}>{row.timeShort}</span>
      </td>
      <td className={`${td} whitespace-nowrap`}>{row.range}</td>
      <td className={`${td} whitespace-nowrap font-heading font-bold`}>{row.hit ?? <span className="font-normal text-muted">—</span>}</td>
      <td className={td}>
        {row.effect ? (
          <span className="flex items-center gap-1.5">
            <MaskIcon src={iconSrc("damageType", row.effect.damageTypeId)} size={16} className="text-muted" />
            <span>{row.effect.label}</span>
          </span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td className={`${td} text-xs text-muted`}>{[row.duration, row.components].filter(Boolean).join(" · ")}</td>
    </tr>
  );
}

// Tabla de conjuros agrupada por nivel (spec de la tabla de conjuros §3.1): la cabecera de cada nivel lleva sus espacios
// de conjuro y cada fila su botón Lanzar. Se desplaza dentro de su caja en móvil.
export default function SpellTable(props: Props) {
  const { rows, filter, slots, used, isOwner, busy, onSetSlot, clearHref } = props;
  const search = useSearchParams().toString();
  const visible = new Set(rows.filter((r) => matchesSpellTable(r, filter)).map((r) => r.key));
  const filtering = filter.q !== "" || filter.kind !== "all" || filter.levels.length > 0
    || filter.concentration !== "any" || filter.ritual !== "any";

  // Niveles con conjuros y, aunque no los tengan, con espacios (se pueden gastar al lanzar uno de nivel inferior)
  const groups = groupByLevel(rows);
  const slotLevels = [
    ...Object.entries(slots.levels).filter(([, n]) => n > 0).map(([l]) => Number(l)),
    ...(slots.pact ? [slots.pact.level] : []),
  ];
  for (const level of slotLevels) {
    if (!groups.some((g) => g.level === level)) groups.push({ level, rows: [] });
  }
  groups.sort((a, b) => a.level - b.level);

  const anyVisible = visible.size > 0;
  return (
    <div className="space-y-3">
      {!anyVisible && rows.length > 0 && (
        <p className="text-sm text-muted print:hidden">
          Ningún conjuro coincide con la búsqueda.{" "}
          <Link href={clearHref} scroll={false} className="font-semibold text-brand-soft hover:underline">Quitar filtros</Link>
        </p>
      )}
      <div className={`${sheetCard} animate-fade-up overflow-x-auto !p-0 ${anyVisible || rows.length === 0 ? "" : "hidden print:block"}`}>
        <table className="w-full min-w-[46rem] text-left text-sm">
          <caption className="sr-only">Conjuros</caption>
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr className="border-b border-line">
              {isOwner && <th scope="col" className={`${th} w-28 print:hidden`}>Lanzar</th>}
              <th scope="col" className={th}>Nombre</th>
              <th scope="col" className={th}>Tiempo</th>
              <th scope="col" className={th}>Alcance</th>
              <th scope="col" className={th}>Golpe/CD</th>
              <th scope="col" className={th}>Efecto</th>
              <th scope="col" className={th}>Notas</th>
            </tr>
          </thead>
          {groups.map((g) => {
            const shown = g.rows.some((r) => visible.has(r.key));
            // Un nivel sin conjuros solo aparece (con sus espacios) mientras no se filtra
            const show = shown || (g.rows.length === 0 && !filtering);
            const count = g.level > 0 ? (slots.levels[String(g.level)] ?? 0) : 0;
            const pact = slots.pact && slots.pact.level === g.level ? slots.pact : null;
            return (
              <tbody key={g.level} className={`divide-y divide-line ${show ? "" : "hidden print:table-row-group"}`}>
                <tr className="bg-surface">
                  <th scope="rowgroup" colSpan={isOwner ? 7 : 6} className="px-3 py-2 text-left">
                    <span className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                      <span className="border-l-4 border-brand pl-3 font-heading text-base font-bold">
                        {g.level === 0 ? "Trucos" : `Nivel ${g.level}`}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        {count > 0 && (
                          <SpellSlotBoxes
                            level={String(g.level)} spellLevel={g.level} count={count} used={used[String(g.level)] ?? 0}
                            onSet={isOwner ? onSetSlot : null} busy={busy}
                          />
                        )}
                        {pact && (
                          <SpellSlotBoxes
                            level={PACT_SLOT} spellLevel={g.level} count={pact.count} used={used[PACT_SLOT] ?? 0}
                            onSet={isOwner ? onSetSlot : null} busy={busy} pact
                          />
                        )}
                      </span>
                    </span>
                  </th>
                </tr>
                {g.rows.map((r) => <Row key={r.key} row={r} visible={visible.has(r.key)} props={props} search={search} />)}
              </tbody>
            );
          })}
        </table>
      </div>
    </div>
  );
}
