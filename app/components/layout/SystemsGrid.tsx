import Link from "next/link";
import { system, systemHref } from "@/lib/utils/systems";

export default function SystemsGrid() {
  return (
    <section id="sistemas">
      <h2 className="mb-5 border-l-4 border-brand pl-3 font-heading text-2xl font-bold">Sistemas</h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-4 pb-16">
        {system.map((s) => {
          const href = systemHref(s);
          const body = (
            <>
              <h3 className="mb-1.5 font-heading text-[1.05rem] font-bold">{s.name}</h3>
              <p className="text-[.92rem] text-muted">{s.text}</p>
            </>
          );
          return href ? (
            <Link
              className="rounded-lg border border-line bg-panel p-5 transition-colors hover:border-brand"
              href={href}
              key={s.id}
            >
              {body}
            </Link>
          ) : (
            <div className="rounded-lg border border-line bg-panel p-5 opacity-70" key={s.id}>
              <span className="mb-1.5 inline-block rounded border border-line px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-muted">
                Próximamente
              </span>
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}
