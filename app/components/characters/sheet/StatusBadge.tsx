import { iconSrc } from "@/lib/utils/icons";

export type CharacterStatus = "active" | "retired" | "dead" | "npc";

// Mismos textos que el selector de estado del creador (también los usan las tarjetas de la campaña)
export const STATUS: Record<CharacterStatus, { label: string; description: string; color: string }> = {
  active: { label: "En activo", description: "¡En plena forma!", color: "bg-success text-black" },
  retired: { label: "Retirado", description: "Ha colgado las armas.", color: "bg-muted text-black" },
  dead: { label: "Fallecido", description: "Descanse en paz.", color: "bg-brand text-white" },
  npc: { label: "PNJ", description: "Personaje no jugador, para el DM.", color: "bg-sky-600 text-white" },
};

/** Silueta del estado (public/images/status), teñida con el color del texto mediante una máscara. */
export function StatusIcon({ status, size = 16 }: { status: CharacterStatus; size?: number }) {
  const mask = `url(${iconSrc("status", status in STATUS ? status : "active")}) center / contain no-repeat`;
  return <span aria-hidden="true" className="block bg-current" style={{ width: size, height: size, mask, WebkitMask: mask }} />;
}

// Icono de estado sobre el retrato, con su explicación al pasar el ratón o al enfocarlo
export default function StatusBadge({ status, isOwner }: { status: CharacterStatus; isOwner: boolean }) {
  const s = STATUS[status] ?? STATUS.active;
  return (
    <span className="group absolute -bottom-1.5 -right-1.5">
      <button
        type="button"
        aria-describedby="status-tip"
        aria-label={`Estado: ${s.label}`}
        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-white ${s.color}`}
      >
        <StatusIcon status={status} size={16} />
      </button>
      <span
        id="status-tip"
        role="tooltip"
        className="pointer-events-none invisible absolute -left-16 top-full z-20 mt-2 w-56 rounded-md border border-line bg-surface px-3 py-2 text-xs opacity-0 shadow-lg transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        <strong className="text-fg">{s.label}:</strong> <span className="text-muted">{s.description}</span>
        {isOwner && <span className="mt-1 block text-muted">Puedes cambiar el estado desde Editar.</span>}
      </span>
    </span>
  );
}
