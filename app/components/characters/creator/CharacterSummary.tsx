"use client";

import { useMemo } from "react";
import { AlertCircle, ArrowRight, CircleCheck, Footprints, Heart, LoaderCircle, Shield, Star, Zap } from "lucide-react";
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import { derive } from "@/lib/rules/dnd2024/derive";
import type { Dnd2024Sheet } from "@/lib/rules/dnd2024/sheet/sheet";
import { fmtMod } from "@/lib/rules/dnd2024/sheet/labels";
import RoundIcon from "../../ui/RoundIcon";
import { StepAnchor } from "./CreatorSteps";

/** `focusId`: control concreto que falta; sin él, el foco va al primer control de la sección. */
export type MissingItem = { label: string; href: string; focusId?: string };

/* Resumen lateral del asistente: quién es el personaje, valores derivados de lo elegido hasta ahora y lo que falta por
   completar. `entries` son las entradas del catálogo ya cargadas, por "libro:clave". */
export default function CharacterSummary({
  name, classIcon, line, sheet, entries, hasSpecies, hasClass, equipmentLoading, missing, onMissing,
}: {
  name: string;
  /** Identificador de la clase elegida, para su icono. */
  classIcon: string | null;
  /** «Especie · Clase · Trasfondo», con lo elegido hasta ahora. */
  line: string;
  sheet: Dnd2024Sheet;
  entries: Map<string, CatalogEntry>;
  hasSpecies: boolean;
  hasClass: boolean;
  /** Mientras se cargan los objetos del equipo, la CA se calcula sin armadura. */
  equipmentLoading: boolean;
  missing: MissingItem[];
  onMissing: (item: MissingItem) => void;
}) {
  const d = useMemo(() => derive(sheet, entries), [sheet, entries]);

  const primaryStats = [
    { label: "Puntos de golpe", short: "PG", value: hasClass ? String(d.hp.max) : "—", icon: Heart, color: "text-brand-soft" },
    { label: "Clase de armadura", short: "CA", value: String(d.ac), icon: Shield, color: "text-sky-400" },
  ];
  const secondaryStats = [
    { label: "Iniciativa", value: fmtMod(d.initiative), icon: Zap },
    { label: "Velocidad", value: hasSpecies ? `${d.speed} pies` : "—", icon: Footprints },
    { label: "Competencia", value: fmtMod(d.proficiencyBonus), icon: Star },
  ];

  return (
    <aside aria-label="Resumen del personaje" className="rounded-xl border border-line bg-panel">
      <div className="flex items-center gap-3 border-b border-line p-5">
        <RoundIcon kind="class" id={classIcon} label={name || "?"} size={48} />
        <div className="min-w-0">
          <h2 className="truncate font-heading text-lg font-extrabold text-white">{name.trim() || "Sin nombre"}</h2>
          <p className="text-xs text-muted">{line || "Nivel 1"}</p>
        </div>
      </div>

      <div className="p-5">
        <dl className="grid grid-cols-2 gap-3">
          {primaryStats.map((s) => (
            <div key={s.short} className="flex flex-col-reverse items-center rounded-lg border border-line bg-surface py-3">
              <dt title={s.label} className="mt-0.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
                <s.icon size={14} className={s.color} aria-hidden="true" />
                <span className="sr-only">{s.label}</span>
                <span aria-hidden="true">{s.short}</span>
              </dt>
              <dd className="font-heading text-3xl font-extrabold text-white">{s.value}</dd>
            </div>
          ))}
        </dl>
        <dl className="mt-2 grid grid-cols-3 gap-2">
          {secondaryStats.map((s) => (
            <div key={s.label} className="flex flex-col-reverse items-center rounded-md border border-line bg-surface/50 px-1 py-2 text-center">
              <dt className="text-[10px] font-bold uppercase tracking-wide text-muted">{s.label}</dt>
              <dd className="font-heading text-sm font-bold text-white">{s.value}</dd>
            </div>
          ))}
        </dl>

        {equipmentLoading && (
          <p className="mt-3 flex items-center justify-center gap-2 rounded-md bg-surface py-2 text-xs font-medium text-muted">
            <LoaderCircle size={14} className="animate-spin text-brand-soft" aria-hidden="true" /> Cargando el equipo…
          </p>
        )}

        <div className="mt-5">
          {missing.length === 0 ? (
            <p className="flex items-center gap-3 rounded-lg border border-success/20 bg-success/10 p-3 text-sm font-medium text-success">
              <CircleCheck size={20} className="shrink-0" aria-hidden="true" /> ¡Todo listo para jugar!
            </p>
          ) : (
            <div className="rounded-lg border border-brand-soft/20 bg-brand-soft/5 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-soft">
                <AlertCircle size={16} aria-hidden="true" /> Falta por completar
              </h3>
              <ul className="space-y-2">
                {missing.map((m) => (
                  <li key={m.label}>
                    <StepAnchor href={m.href} onGo={() => onMissing(m)} className="group flex items-center gap-2 text-sm text-muted transition-colors hover:text-white">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-line bg-surface group-hover:border-brand-soft group-hover:bg-brand-soft/10">
                        <ArrowRight size={12} className="text-transparent transition-colors group-hover:text-brand-soft" aria-hidden="true" />
                      </span>
                      <span className="underline-offset-2 group-hover:underline">{m.label}</span>
                    </StepAnchor>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
