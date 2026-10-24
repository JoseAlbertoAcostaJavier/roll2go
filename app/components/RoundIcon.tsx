"use client";

import { useState } from "react";
import { iconSrc, type IconKind } from "@/lib/icons";

// Las insignias de clase y escuela son un disco de color con el borde de trazo de pincel: se amplían para que el disco
// llene el círculo (el borde irregular queda fuera) con el símbolo en el centro
const BADGE_ZOOM = 1.4;

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
          className={`animate-fade-in h-full w-full ${kind === "species" ? "object-cover" : "object-contain"}`}
          style={kind === "species" ? undefined : { transform: `scale(${BADGE_ZOOM})` }}
          onError={() => setFailed(src)}
        />
      ) : (
        label?.trim().charAt(0).toUpperCase()
      )}
    </span>
  );
}
