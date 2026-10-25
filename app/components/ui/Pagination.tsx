import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

const link = "flex items-center gap-1 rounded-md px-2 py-1 text-muted transition-colors hover:bg-surface hover:text-white";

// Enlaces de página anterior / siguiente. href(n) devuelve la dirección de la página n.
export default function Pagination({
  page,
  pages,
  href,
  prevLabel = "Anteriores",
  nextLabel = "Siguientes",
}: {
  page: number;
  pages: number;
  href: (n: number) => string;
  prevLabel?: string;
  nextLabel?: string;
}) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Paginación" className="mt-6 flex items-center justify-between gap-3 text-sm">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={link}>
          <ChevronLeft size={16} aria-hidden="true" /> {prevLabel}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted" aria-current="page">
        Página {page} de {pages}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} rel="next" className={link}>
          {nextLabel} <ChevronRight size={16} aria-hidden="true" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
