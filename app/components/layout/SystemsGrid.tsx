import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { isSystemAvailable, system, systemHref, type System } from "@/lib/utils/systems";

function SystemCardBody({ s, available }: { s: System; available: boolean }) {
  return (
    <>
      <Image
        src={s.image}
        alt=""
        fill
        sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
        className={`object-cover object-right transition duration-500 ease-out motion-reduce:transition-none ${
          available ? "group-hover:scale-105 group-focus-visible:scale-105" : "opacity-70 brightness-75 saturate-[.45] group-hover:scale-[1.015]"
        }`}
      />
      {/* La tarjeta es menos apaisada que la imagen y recorta parte de su degradado: este asegura que el texto se lea */}
      <span aria-hidden="true" className="absolute inset-0 bg-linear-to-r from-[#17171b] from-20% via-[#17171b]/60 via-40% to-transparent to-60% max-sm:via-[#17171b]/85 max-sm:to-[#17171b]/30 xl:via-[#17171b]/70 xl:via-42% xl:to-72%" />

      <div className="relative flex max-w-[min(100%,24rem)] flex-col items-start p-6 sm:max-w-[58%] lg:p-8 xl:max-w-[70%] xl:p-4">
        <span className={`flex items-center gap-2 rounded-full border px-3 py-1 font-heading text-[.68rem] font-bold xl:px-2 xl:py-0.5 xl:text-[.58rem] uppercase tracking-[.14em] ${
          available ? "border-brand/50 bg-brand/15 text-brand-soft" : "border-line-strong bg-black/30 text-muted"
        }`}>
          {available && <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-soft" />}
          {available ? "Disponible" : "Próximamente"}
        </span>

        <h3 className="mt-5 xl:mt-2.5">
          <span className="sr-only">{s.name}</span>
          <span aria-hidden="true" className="block">
            {s.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.logo} alt="" className={`h-14 w-auto max-w-full lg:h-16 xl:h-9 ${available ? "" : "opacity-80 saturate-50"}`} />
            ) : (
              <span className={`block font-display text-3xl leading-tight lg:text-4xl xl:text-xl ${available ? "text-white" : "text-fg"}`}>{s.title}</span>
            )}
            <span className={`mt-2 block font-display text-2xl leading-none lg:text-3xl xl:mt-1 xl:text-base ${available ? "text-fg" : "text-muted"}`}>{s.edition}</span>
          </span>
        </h3>

        <span aria-hidden="true" className={`mt-4 h-0.5 w-14 shrink-0 xl:hidden ${available ? "bg-brand" : "bg-line-strong"}`} />
        <p className={`mt-4 text-sm leading-relaxed xl:mt-1.5 xl:text-xs xl:leading-snug ${available ? "text-fg" : "text-muted"}`}>{s.text}</p>

        {available && (
          <span className="mt-auto flex items-center gap-2 pt-5 font-heading text-sm font-bold xl:pt-2 xl:text-[.7rem] uppercase tracking-wider text-brand-soft">
            <span className="border-b-2 border-brand pb-0.5">Explorar sistema</span>
            <ArrowRight size={16} aria-hidden="true" className="transition-transform group-hover:translate-x-1.5 motion-reduce:transition-none" />
          </span>
        )}
      </div>
    </>
  );
}

const card = "group relative flex min-h-88 overflow-hidden rounded-xl border bg-[#17171b] xl:aspect-16/10 xl:min-h-0";

export default function SystemsGrid() {
  // Primero los que se pueden usar, sin cambiar el orden del resto
  const ordered = [...system].sort((a, b) => Number(isSystemAvailable(b)) - Number(isSystemAvailable(a)));
  return (
    <section id="sistemas">
      <h2 className="mb-5 border-l-4 border-brand pl-3 font-heading text-2xl font-bold">Sistemas</h2>
      <div className="grid gap-5 pb-16 md:grid-cols-2 xl:grid-cols-3">
        {ordered.map((s) => {
          const href = systemHref(s);
          return href ? (
            <Link
              key={s.id}
              href={href}
              className={`${card} border-line-strong shadow-lg transition duration-300 hover:-translate-y-1 hover:border-brand hover:shadow-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none motion-reduce:hover:translate-y-0`}
            >
              <SystemCardBody s={s} available />
            </Link>
          ) : (
            <div key={s.id} className={`${card} border-line`}>
              <SystemCardBody s={s} available={false} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
