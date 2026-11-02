import Link from "next/link";
import { sectionHref } from "@/lib/rules/dnd2024/sheet/sheetSections";

type Query = Record<string, string | string[] | undefined>;

const chip = (on: boolean) =>
  `shrink-0 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
    on ? "border-brand bg-brand text-white" : "border-line text-muted hover:text-white"
  }`;

// Chips de sección de las pestañas Rasgos y Trasfondo (spec de rasgos §3–4): enlaces con `?seccion=`, para poder
// compartirlos; en móvil se desplazan en horizontal dentro de su fila. No se imprimen.
export default function SectionChips<T extends string>({ chips, active, base, query, label }: {
  chips: readonly { id: T; label: string }[];
  active: T;
  base: string;
  query: Query;
  label: string;
}) {
  return (
    <nav aria-label={label} className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1 print:hidden">
      {chips.map((c) => (
        <Link
          key={c.id}
          href={`${base}${sectionHref(query, c.id)}`}
          scroll={false}
          aria-current={c.id === active ? "page" : undefined}
          className={chip(c.id === active)}
        >
          {c.label}
        </Link>
      ))}
    </nav>
  );
}
