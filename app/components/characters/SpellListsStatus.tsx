import { LoaderCircle } from "lucide-react";

/** Aviso mientras llegan las listas de conjuros (`useSpellLists`) o si no se pudieron cargar. */
export default function SpellListsStatus({ error }: { error: boolean }) {
  return error ? (
    <p role="alert" className="text-sm text-brand-soft">No se pudieron cargar los conjuros. Recarga la página para intentarlo de nuevo.</p>
  ) : (
    <p role="status" className="flex items-center gap-2 text-sm text-muted">
      <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> Cargando conjuros…
    </p>
  );
}
