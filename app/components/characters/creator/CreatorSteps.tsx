"use client";

import { useEffect, useRef } from "react";
import { Check, type LucideIcon } from "lucide-react";

/**
 * `pending`: true si faltan cosas, false si está completo, null si el paso es opcional. `seen`: ya se ha visitado.
 * `locked`: aún no se puede abrir (al subir de nivel, los pasos tras la primera elección sin hacer).
 */
export type CreatorStep = {
  id: string;
  label: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  pending: boolean | null;
  seen: boolean;
  locked?: boolean;
};

const FOCUSABLE = "input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])";

/* Lleva el foco a un control de una sección ya visible: el indicado o su primer control. Sirve para controles nativos y
   para el combo de RuleSelect, que es un input. Sin controles, el foco va a la propia sección. */
export function focusSection(href: string, focusId?: string) {
  const section = document.getElementById(href.replace(/^#/, ""));
  if (!section) return;
  const byId = focusId ? document.getElementById(focusId) : null;
  const target = byId && section.contains(byId) ? byId : section.querySelector<HTMLElement>(FOCUSABLE);
  if (target) {
    // RuleSelect abre su lista al recibir el foco; un foco programático no debe abrirla
    target.dataset.skipOpen = "1";
    target.focus({ preventScroll: true });
    delete target.dataset.skipOpen;
    target.scrollIntoView({ block: "center" });
  } else {
    section.tabIndex = -1;
    section.focus({ preventScroll: true });
    section.scrollIntoView();
  }
}

/** Enlace a un paso: con ctrl, meta, mayús o botón central se deja al navegador (pestaña nueva…). */
export function StepAnchor({ href, onGo, className, children, ...rest }: {
  href: string;
  onGo: () => void;
  className?: string;
  children: React.ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className" | "onClick">) {
  return (
    <a
      {...rest}
      href={href}
      className={className}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        onGo();
      }}
    >
      {children}
    </a>
  );
}

const stateText = (s: CreatorStep) => (s.pending === null ? "opcional" : s.pending ? "pendiente" : "completo");

/* Barra de progreso de los asistentes (crear personaje y subir de nivel). Se puede saltar a cualquier paso no bloqueado: la marca de completo sale de las mismas
   comprobaciones que «Falta por completar», y solo se pinta en los pasos ya vistos (las características parten de valores
   válidos: si no, saldrían completas sin haberlas abierto). */
export default function CreatorStepper({ steps, current, onGo }: {
  steps: CreatorStep[];
  current: string;
  onGo: (id: string) => void;
}) {
  const index = Math.max(steps.findIndex((s) => s.id === current), 0);

  // Con más pasos de los que caben, la barra se desplaza por dentro y el actual queda a la vista
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const box = list.current;
    const active = box?.querySelector("[aria-current=step]");
    if (!box || !active || box.scrollWidth <= box.clientWidth) return;
    const b = box.getBoundingClientRect();
    const a = active.getBoundingClientRect();
    box.scrollLeft += a.left - b.left - (b.width - a.width) / 2;
  }, [current]);

  return (
    <nav aria-label="Pasos" className="rounded-xl border border-line bg-panel px-3 py-4 sm:px-5">
      <ol ref={list} className="-m-1 flex overflow-x-auto p-1">
        {steps.map((s, i) => {
          const active = s.id === current;
          const done = s.seen && s.pending === false;
          const Icon = s.icon;
          return (
            <li key={s.id} className="relative min-w-9.5 flex-1">
              {i > 0 && (
                <span
                  aria-hidden="true"
                  // De borde a borde de los círculos (2.25rem de diámetro), sin pasar por encima de sus iconos
                  className={`absolute right-[calc(50%+1.125rem)] top-[1.0625rem] h-0.5 w-[calc(100%-2.25rem)] transition-colors ${i <= index ? "bg-brand" : "bg-line"}`}
                />
              )}
              {(() => {
                const inner = (
                  <>
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${
                        active
                          ? "border-brand bg-brand text-white"
                          : done
                            ? "border-success bg-panel text-success"
                            : i < index
                              ? "border-brand bg-panel text-brand-soft"
                              : "border-line-strong bg-panel text-muted group-hover:border-fg group-hover:text-white"
                      }`}
                    >
                      {done && !active ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />}
                    </span>
                    <span title={s.label} className={`hidden w-full px-1 text-xs leading-tight line-clamp-2 md:[display:-webkit-box] ${active ? "font-bold text-white" : "font-medium text-muted group-hover:text-white"}`}>
                      {s.label}
                    </span>
                    <span className="sr-only md:hidden">{s.label}</span>
                    <span className="sr-only">({stateText(s)})</span>
                  </>
                );
                const shape = "relative flex flex-col items-center gap-1.5 rounded-md text-center";
                return s.locked ? (
                  <span aria-disabled="true" className={`${shape} cursor-not-allowed opacity-50`}>{inner}</span>
                ) : (
                  <StepAnchor href={`#${s.id}`} onGo={() => onGo(s.id)} aria-current={active ? "step" : undefined} className={`group ${shape}`}>
                    {inner}
                  </StepAnchor>
                );
              })()}
            </li>
          );
        })}
      </ol>
      {/* Sin sitio para las etiquetas: solo la del paso actual */}
      <p className="mt-3 text-center text-sm md:hidden" aria-hidden="true">
        <span className="text-muted">Paso {index + 1} de {steps.length}:</span>{" "}
        <span className="font-bold text-white">{steps[index]?.label}</span>
      </p>
    </nav>
  );
}

/* Un paso del asistente. Los ocultos siguen montados: conservan los archivos elegidos, las listas de conjuros cargadas y
   los errores de sus campos. */
export function StepSection({ step, number, total, active, children }: {
  step: CreatorStep;
  number: number;
  total: number;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={step.id} hidden={!active} aria-labelledby={`${step.id}-title`} className="animate-fade-up rounded-xl border border-line bg-panel p-5 sm:p-7">
      <header className="mb-6 flex items-start gap-3 border-b border-line pb-4">
        <div className="min-w-0 flex-1">
          <h2 id={`${step.id}-title`} tabIndex={-1} className="font-heading text-xl font-extrabold text-white outline-none">
            {step.title}
          </h2>
          {step.description && <p className="text-sm text-muted">{step.description}</p>}
        </div>
        <span className="hidden shrink-0 rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold uppercase tracking-wider text-muted sm:block">
          Paso {number} de {total}
        </span>
      </header>
      {children}
    </section>
  );
}
