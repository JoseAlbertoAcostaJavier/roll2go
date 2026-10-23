import { Armchair, HeartPulse, Skull } from "lucide-react";

export type CharacterStatus = "active" | "retired" | "dead";

// Mismos textos que el selector de estado del creador
const STATUS: Record<CharacterStatus, { label: string; description: string; icon: typeof HeartPulse; color: string }> = {
  active: { label: "En activo", description: "¡En plena forma!", icon: HeartPulse, color: "bg-success text-black" },
  retired: { label: "Retirado", description: "Ha colgado las armas.", icon: Armchair, color: "bg-muted text-black" },
  dead: { label: "Fallecido", description: "Descanse en paz.", icon: Skull, color: "bg-brand text-white" },
};

// Icono de estado sobre el retrato, con su explicación al pasar el ratón o al enfocarlo
export default function StatusBadge({ status, isOwner }: { status: CharacterStatus; isOwner: boolean }) {
  const s = STATUS[status] ?? STATUS.active;
  const Icon = s.icon;
  return (
    <span className="group absolute -bottom-1.5 -right-1.5">
      <button
        type="button"
        aria-describedby="status-tip"
        aria-label={`Estado: ${s.label}`}
        className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-panel ${s.color}`}
      >
        <Icon size={14} aria-hidden="true" />
      </button>
      <span
        id="status-tip"
        role="tooltip"
        className="pointer-events-none invisible absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2 rounded-md border border-line bg-surface px-3 py-2 text-xs opacity-0 shadow-lg transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        <strong className="text-fg">{s.label}:</strong> <span className="text-muted">{s.description}</span>
        {isOwner && <span className="mt-1 block text-muted">Puedes cambiar el estado desde Editar.</span>}
      </span>
    </span>
  );
}
