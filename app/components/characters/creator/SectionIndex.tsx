"use client";

import { Circle, CircleCheck, CircleDashed } from "lucide-react";

/** `pending`: true si faltan cosas, false si está completa, null si la sección no tiene comprobaciones (opcional). */
export type SectionLink = { label: string; href: string; pending: boolean | null };

const FOCUSABLE = "input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])";

/* Al seguir un enlace a una sección, la desplaza a la vista (con su `scroll-mt`) y lleva el foco a su primer control.
   Sirve para controles nativos y para el combo de RuleSelect, que es un input. Sin controles, el foco va a la
   propia sección. */
export function focusSection(href: string, focusId?: string) {
  const id = href.replace(/^#/, "");
  const section = document.getElementById(id);
  if (!section) return;
  // En móvil el índice es un `<details>`: se pliega al seguir un enlace
  document.querySelectorAll<HTMLDetailsElement>("details[open]").forEach((d) => {
    if (d.contains(document.activeElement) || d.querySelector(`a[href="#${id}"]`)) d.open = false;
  });
  section.scrollIntoView();
  history.replaceState(null, "", href);
  const byId = focusId ? document.getElementById(focusId) : null;
  const target = byId && section.contains(byId) ? byId : section.querySelector<HTMLElement>(FOCUSABLE);
  if (target) {
    // RuleSelect abre su lista al recibir el foco; un foco programático no debe abrirla
    target.dataset.skipOpen = "1";
    target.focus({ preventScroll: true });
    delete target.dataset.skipOpen;
    // Clase o Tamaño pueden quedar abajo de la sección: se asegura que el control se vea, bajo la cabecera
    const r = target.getBoundingClientRect();
    if (r.top < 96 || r.bottom > window.innerHeight) target.scrollIntoView({ block: "center" });
  } else {
    section.tabIndex = -1;
    section.focus({ preventScroll: true });
  }
}

export function SectionLinkAnchor({ href, focusId, className, children }: { href: string; focusId?: string; className?: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        // Con ctrl, meta, mayús o botón central se deja al navegador (pestaña nueva…)
        if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        // La navegación por fragmento del enlace correría después y quitaría el foco
        e.preventDefault();
        focusSection(href, focusId);
      }}
    >
      {children}
    </a>
  );
}

/* Índice de las secciones del creador con una marca de completa o pendiente, calculada con las mismas
   comprobaciones que «Falta por completar». */
export default function SectionIndex({ sections }: { sections: SectionLink[] }) {
  return (
    <nav aria-label="Secciones del creador">
      <ol className="space-y-0.5 text-sm">
        {sections.map((s) => (
          <li key={s.href}>
            <SectionLinkAnchor href={s.href} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface">
              {s.pending === null ? (
                <Circle size={16} className="shrink-0 text-muted" aria-hidden="true" />
              ) : s.pending ? (
                <CircleDashed size={16} className="shrink-0 text-brand-soft" aria-hidden="true" />
              ) : (
                <CircleCheck size={16} className="shrink-0 text-success" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1">{s.label}</span>
              <span className="sr-only">{s.pending === null ? "opcional" : s.pending ? "pendiente" : "completa"}</span>
            </SectionLinkAnchor>
          </li>
        ))}
      </ol>
    </nav>
  );
}
