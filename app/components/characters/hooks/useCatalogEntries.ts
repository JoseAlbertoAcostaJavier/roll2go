"use client";

import { useEffect, useRef, useState } from "react";
import type { CatalogEntry } from "@/lib/rules/catalog/types";
import { refKey } from "@/lib/rules/dnd2024/sheet/equipmentRefs";
import type { Ref } from "@/lib/rules/types";

/* Entradas completas del catálogo pedidas al servidor (descripciones, objetos del equipo…), por `libro:clave`:
   undefined = cargando; null = no disponible. Cada referencia se pide una sola vez. */
export default function useCatalogEntries(refs: Ref[], campaignId: string | null) {
  const [cache, setCache] = useState<Record<string, CatalogEntry | null>>({});
  const requested = useRef(new Set<string>());
  useEffect(() => {
    const qs = campaignId ? `?campaign=${encodeURIComponent(campaignId)}` : "";
    for (const ref of refs) {
      const k = refKey(ref);
      if (requested.current.has(k)) continue;
      requested.current.add(k);
      // Las claves llevan ":" y "|": van codificadas en la dirección
      fetch(`/api/rules/entries/${encodeURIComponent(ref.book)}/${encodeURIComponent(ref.key)}${qs}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => setCache((c) => ({ ...c, [k]: (data?.entry as CatalogEntry | undefined) ?? null })))
        .catch(() => setCache((c) => ({ ...c, [k]: null })));
    }
  }, [refs, campaignId]);
  return cache;
}
