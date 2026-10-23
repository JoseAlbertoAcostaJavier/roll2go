"use client";

import { useState } from "react";

/* Imagen de la clase en un círculo (`/images/classes/<identifier>.webp`). Sin clase, o si la imagen no carga, el
   círculo queda vacío. */
export default function ClassBadge({ identifier, size = 44 }: { identifier: string | null; size?: number }) {
  // Identificador cuya imagen falló (al cambiar de clase se vuelve a intentar)
  const [failed, setFailed] = useState<string | null>(null);
  const show = !!identifier && failed !== identifier;
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface"
      style={{ width: size, height: size }}
    >
      {show && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={identifier}
          src={`/images/classes/${identifier}.webp`}
          alt=""
          className="animate-fade-in h-full w-full object-cover"
          onError={() => setFailed(identifier)}
        />
      )}
    </span>
  );
}
