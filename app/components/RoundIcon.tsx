"use client";

import { useState } from "react";
import { iconSrc, type IconKind } from "@/lib/icons";

/* Icono de clase, escuela o especie en un círculo con borde blanco. Sin icono (homebrew, especie sin imagen) o si la
   imagen no carga, el círculo muestra la inicial de `label`. Es decorativo: el nombre ya está en el texto de al lado. */
export default function RoundIcon({ kind, id, label, size = 44, className = "" }: {
  kind: Exclude<IconKind, "status">;
  /** Identificador (clase, especie) o letra de escuela de 5etools. */
  id: string | null | undefined;
  label?: string;
  size?: number;
  className?: string;
}) {
  const src = iconSrc(kind, id);
  // Ruta cuya imagen falló (al cambiar de icono se vuelve a intentar)
  const [failed, setFailed] = useState<string | null>(null);
  const show = !!src && failed !== src;
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-surface font-heading font-bold text-muted shadow-sm ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          className="animate-fade-in h-full w-full object-cover"
          onError={() => setFailed(src)}
        />
      ) : (
        label?.trim().charAt(0).toUpperCase()
      )}
    </span>
  );
}
