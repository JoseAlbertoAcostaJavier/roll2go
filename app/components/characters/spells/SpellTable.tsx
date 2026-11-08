"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { CasterBlock, Slots } from "@/lib/rules/dnd2024/derive";
import type { SheetCustom } from "@/lib/rules/dnd2024/sheet/custom";
import { refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import { PACT_SLOT } from "@/lib/rules/dnd2024/spells/spellOps";
import type { SpellRow } from "@/lib/rules/dnd2024/spells/spellTable";
import { groupByLevel, matchesSpellTable, type SpellTableFilter } from "@/lib/rules/dnd2024/spells/spellTableFilter";
import { iconSrc, spellAreaSrc } from "@/lib/utils/icons";
import MaskIcon from "@/app/components/ui/MaskIcon";
import OrderedSection, { type OrderedRow } from "../sheet/OrderedSection";
import { d20Expr, diceIn } from "@/lib/utils/diceText";
import { RollButton } from "../sheet/rolls";
import { switchThumb, switchTrack } from "../sheet/statUi";
import { Uses } from "./LimitedUses";
import SpellSlotBoxes from "./SpellSlotBoxes";
import { spellHrefFrom, type SpellOpener } from "./SpellList";

type Props = {
  /** Todas las filas: el filtro solo decide qué se ve en pantalla, la hoja impresa sale completa. */
  rows: SpellRow[];
  filter: SpellTableFilter;
  /** Solo los preparados (y los que no se preparan: trucos, siempre preparados…). */
  preparedOnly: boolean;
  blocks: CasterBlock[];
  slots: Slots;
  /** Espacios gastados por nivel ("1".."9" y "pact"). */
  used: Record<string, number>;
  /** Usos gastados de los conjuros limitados, por clave. */
  limitedUsed: Record<string, number>;
  /** Solo el dueño prepara y marca casillas. */
  isOwner: boolean;
  busy: boolean;
  onPrepare: (row: SpellRow, prepared: boolean) => void;
  onSetSlot: (level: string, used: number) => void;
  onSetLimited: (key: string, used: number) => void;
  onOpen: SpellOpener;
  /** Dirección que quita todos los filtros. */
  clearHref: string;
  characterId: string;
  custom: SheetCustom;
};

// Columnas de cada fila y de la barra de su nivel: nombre | alcance | golpe/CD | daño
const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_7rem_5.5rem_6.5rem]";

function Flag({ letter, title }: { letter: string; title: string }) {
  return (
    <abbr title={title} className="flex size-5 items-center justify-center rounded-full bg-surface text-[10px] font-bold text-fg no-underline">
      {letter}
      <span className="sr-only"> ({title})</span>
    </abbr>
  );
}

// Interruptor de preparar: en los preparables; los siempre preparados y demás no lo tienen
function PrepareSwitch({ row, block, props }: { row: SpellRow; block: CasterBlock; props: Props }) {
  const prepared = block.prepared.some((r) => refKey(r) === row.key);
  const full = block.prepared.length >= block.preparedLimit;
  const disabled = props.busy || (!prepared && full);
  return (
    <label
      title={!prepared && full ? `Ya tienes ${block.prepared.length} de ${block.preparedLimit} preparados` : prepared ? "Dejar de preparar" : "Preparar"}
      className={`${switchTrack} print:hidden`}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={prepared}
        disabled={disabled}
        aria-label={`Preparar ${row.name}`}
        onChange={() => props.onPrepare(row, prepared)}
      />
      <span aria-hidden="true" className={switchThumb} />
    </label>
  );
}

function RowView({ row, block, props, search }: { row: SpellRow; block: CasterBlock | null; props: Props; search: string }) {
  const { isOwner, busy } = props;
  const limitedUsed = row.limited ? (props.limitedUsed[row.limited.key] ?? row.limited.used) : 0;
  const notes = [row.timeShort, row.duration, row.components].filter(Boolean).join(" · ");
  const expr = row.damage ? diceIn(row.damage.dice) : null;
  return (
    <div className={ROW_GRID}>
      <div className="col-span-2 flex min-w-0 items-start gap-2 sm:col-span-1">
        {isOwner && row.prepare && block && <PrepareSwitch row={row} block={block} props={props} />}
        {row.limited && isOwner && (
          <Uses
            item={{ key: row.limited.key, spell: { ref: row.ref, name: row.name }, origin: row.origin, max: row.limited.max, used: limitedUsed }}
            onSet={props.onSetLimited}
            busy={busy}
          />
        )}
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-x-1.5">
            <MaskIcon src={iconSrc("darkSchool", row.schoolId)} size={14} label={row.school} className="text-muted" />
            <a
              href={spellHrefFrom(search, row.ref)}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                props.onOpen(row.ref, e.currentTarget);
              }}
              className="font-semibold text-white hover:text-brand-soft hover:underline"
            >
              {row.name}
            </a>
            {row.concentration && <Flag letter="C" title="Concentración" />}
            {row.ritual && <Flag letter="R" title="Ritual" />}
          </span>
          <span className="block text-xs text-muted">{row.origin}{notes && ` · ${notes}`}</span>
          {row.limited && (
            <span className={`text-xs text-muted ${isOwner ? "hidden print:block" : "block"}`}>
              Usos disponibles: {row.limited.max - Math.min(limitedUsed, row.limited.max)}/{row.limited.max}
            </span>
          )}
        </span>
      </div>
      <span className="text-muted sm:order-none">
        <span className="block">{row.range}</span>
        {row.area && (
          <span className="flex items-center gap-1 text-xs" title={`${row.area.name} de ${row.area.size}`}>
            <MaskIcon src={spellAreaSrc(row.area.shape)} size={12} label={row.area.name} />
            {!spellAreaSrc(row.area.shape) && <span className="capitalize">{row.area.name}</span>}
            {row.area.size}
          </span>
        )}
      </span>
      <span className="font-heading font-bold text-success">
        {row.hit && /^[+-]\d+$/.test(row.hit)
          ? <RollButton label={`${row.name}: ataque`} expr={d20Expr(Number(row.hit))} d20>{row.hit}</RollButton>
          : row.hit ?? <span className="font-normal text-muted">—</span>}
      </span>
      <span className={`flex flex-wrap items-center gap-1.5 font-semibold ${row.damage?.healing ? "text-success" : "text-brand-soft"}`}>
        {row.damage ? (
          <>
            {expr ? <RollButton label={`${row.name}: ${row.damage.healing ? "curación" : "daño"}`} expr={expr}>{row.damage.dice}</RollButton> : row.damage.dice}
            {row.damage.healing
              ? <span className="text-xs font-normal">Curación</span>
              : <MaskIcon src={iconSrc("damageType", row.damage.damageTypeId)} size={15} className="text-brand-soft" />}
          </>
        ) : <span className="font-normal text-muted">—</span>}
      </span>
    </div>
  );
}

// Conjuros por nivel: la barra de cada nivel lleva sus espacios y cada fila, su interruptor de preparar. Se ven los que puede
// preparar y, con «Solo preparados», únicamente los que tiene a punto.
export default function SpellTable(props: Props) {
  const { rows, filter, preparedOnly, blocks, slots, used, isOwner, busy, onSetSlot, clearHref, characterId, custom } = props;
  const search = useSearchParams().toString();
  const blockOf = (row: SpellRow) => (row.prepare ? blocks.find((b) => refKey(b.class) === refKey(row.prepare!)) ?? null : null);
  const isPrepared = (row: SpellRow) => {
    const block = blockOf(row);
    return !block || block.prepared.some((r) => refKey(r) === row.key);
  };
  const matches = (row: SpellRow) => matchesSpellTable(row, filter) && (!preparedOnly || isPrepared(row));
  const visible = new Set(rows.filter(matches).map((r) => r.key));
  const filtering = filter.q !== "" || filter.kind !== "all" || filter.levels.length > 0
    || filter.concentration !== "any" || filter.ritual !== "any" || preparedOnly;

  // Niveles con conjuros y, aunque no los tengan, con espacios
  const groups = groupByLevel(rows);
  const slotLevels = [
    ...Object.entries(slots.levels).filter(([, n]) => n > 0).map(([l]) => Number(l)),
    ...(slots.pact ? [slots.pact.level] : []),
  ];
  for (const level of slotLevels) {
    if (!groups.some((g) => g.level === level)) groups.push({ level, rows: [] });
  }
  groups.sort((a, b) => a.level - b.level);

  return (
    <div className="space-y-4">
      {visible.size === 0 && rows.length > 0 && (
        <p className="text-sm text-muted print:hidden">
          Ningún conjuro coincide con la búsqueda.{" "}
          <Link href={clearHref} scroll={false} className="font-semibold text-brand-soft hover:underline">Quitar filtros</Link>
        </p>
      )}
      {groups.map((g) => {
        const shown = g.rows.some((r) => visible.has(r.key));
        const show = shown || (g.rows.length === 0 && !filtering);
        const count = g.level > 0 ? (slots.levels[String(g.level)] ?? 0) : 0;
        const pact = slots.pact && slots.pact.level === g.level ? slots.pact : null;
        const orderedRows: OrderedRow[] = g.rows.map((r) => ({
          key: r.key,
          label: r.name,
          // Sin preparar no se imprime; lo filtrado no se ve en pantalla, pero sí en papel si está preparado
          className: `${visible.has(r.key) ? "" : isPrepared(r) ? "hidden print:flex" : "hidden"} ${isPrepared(r) ? "" : "print:hidden"}`,
          node: <RowView row={r} block={blockOf(r)} props={props} search={search} />,
        }));
        return (
          <OrderedSection
            key={g.level}
            id={`conjuros:${g.level}`}
            title={g.level === 0 ? "Trucos" : `Nivel ${g.level}`}
            className={`animate-fade-up ${show ? "" : "hidden print:block"}`}
            extra={(count > 0 || pact) && (
              <span className="inline-flex flex-wrap items-center gap-x-3">
                {count > 0 && <SpellSlotBoxes level={String(g.level)} spellLevel={g.level} count={count} used={used[String(g.level)] ?? 0} onSet={isOwner ? onSetSlot : null} busy={busy} />}
                {pact && <SpellSlotBoxes level={PACT_SLOT} spellLevel={g.level} count={pact.count} used={used[PACT_SLOT] ?? 0} onSet={isOwner ? onSetSlot : null} busy={busy} pact />}
              </span>
            )}
            columns={(
              <span className="hidden gap-3 sm:flex">
                <span className="w-[7rem]">Alcance</span><span className="w-[5.5rem]">Golpe/CD</span><span className="w-[6.5rem]">Daño</span>
              </span>
            )}
            rows={orderedRows}
            custom={custom}
            characterId={characterId}
            isOwner={isOwner}
            canHide={false}
          />
        );
      })}
    </div>
  );
}
