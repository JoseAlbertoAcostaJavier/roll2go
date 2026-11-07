import { LoaderCircle } from "lucide-react";

/** Aviso mientras llegan las listas de conjuros (`useSpellLists`) o, si no se pudieron cargar, con «Reintentar». */
export default function SpellListsStatus({ error, onRetry }: { error: boolean; onRetry: () => void }) {
  return error ? (
    <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-danger">
      <span>No se pudieron cargar los conjuros.</span>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md border border-line px-3 py-1.5 font-semibold text-fg transition-colors hover:border-brand hover:text-white"
      >
        Reintentar
      </button>
    </div>
  ) : (
    <p role="status" className="flex items-center gap-2 text-sm text-muted">
      <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> Cargando conjuros…
    </p>
  );
}
