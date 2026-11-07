"use client";

import { useRouter } from "next/navigation";

// Filtro «Mostrar» de las pestañas de la ficha: cada opción es una dirección, para poder compartirla
export default function ShowSelect({ label, value, options }: {
  label: string; value: string; options: { id: string; label: string; href: string }[];
}) {
  const router = useRouter();
  return (
    <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-muted print:hidden">
      Mostrar
      <select
        aria-label={label}
        value={value}
        onChange={(e) => {
          const href = options.find((o) => o.id === e.target.value)?.href;
          if (href) router.push(href, { scroll: false });
        }}
        className="rounded-md border border-line-strong bg-surface px-2 py-2 text-sm font-semibold text-fg focus:border-brand focus:outline-none"
      >
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </label>
  );
}
