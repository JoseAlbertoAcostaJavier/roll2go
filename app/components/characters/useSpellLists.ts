"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SpellOption } from "@/lib/rules/catalog";
import { refKey } from "@/lib/rules/dnd2024/equipmentRefs";
import { ALL_LISTS, spellOptionOf, type SpellRow } from "@/lib/rules/spellRows";

/** De dónde salen las listas: los libros de un personaje o, al crearlo, los que puede usar el usuario. */
export type SpellListSource =
  | { characterId: string }
  | { systemId: string; books: string[]; campaignId: string | null };

export type SpellListStatus = "ready" | "loading" | "error";

// Dirección de la ruta hasta `list=` (la lista va al final)
const baseOf = (source: SpellListSource) => {
  if ("characterId" in source) return `/api/characters/${source.characterId}/spells/list?list=`;
  const qs = new URLSearchParams({ system: source.systemId });
  if (source.books.length) qs.set("books", source.books.join(","));
  if (source.campaignId) qs.set("campaign", source.campaignId);
  return `/api/rules/spells?${qs.toString()}&list=`;
};

/* Listas de conjuros pedidas al servidor bajo demanda (spec ampliación de conjuros §5), cada una una sola vez:
   `spells` son todas las cargadas hasta ahora (los componentes filtran por su lista) y `status(listas)` dice si unas
   listas de las pedidas ya están, aún cargan o no se pudieron cargar; `retry` vuelve a pedir las que fallaron. Si se
   pide `ALL_LISTS`, solo se pide esa. */
export default function useSpellLists(source: SpellListSource, lists: string[]) {
  const [loaded, setLoaded] = useState<Record<string, SpellOption[] | null>>({});
  const requested = useRef(new Set<string>());
  const [attempt, setAttempt] = useState(0);
  const base = baseOf(source);
  const key = [...new Set(lists)].sort().join("\n");

  useEffect(() => {
    const wanted = key ? key.split("\n") : [];
    for (const list of wanted.includes(ALL_LISTS) ? [ALL_LISTS] : wanted) {
      if (requested.current.has(list)) continue;
      requested.current.add(list);
      fetch(`${base}${encodeURIComponent(list)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => setLoaded((l) => ({
          ...l, [list]: Array.isArray(data?.spells) ? (data.spells as SpellRow[]).map(spellOptionOf) : null,
        })))
        .catch(() => setLoaded((l) => ({ ...l, [list]: null })));
    }
  }, [base, key, attempt]);

  const spells = useMemo(() => {
    const byKey = new Map<string, SpellOption>();
    for (const l of Object.values(loaded)) for (const s of l ?? []) byKey.set(refKey(s.ref), s);
    return [...byKey.values()];
  }, [loaded]);

  // `*` cargada sirve para cualquier lista
  const status = (some: string[]): SpellListStatus => {
    const missing = some.filter((l) => !loaded[l] && !loaded[ALL_LISTS]);
    if (!missing.length) return "ready";
    const viaAll = key.split("\n").includes(ALL_LISTS);
    return missing.some((l) => loaded[viaAll ? ALL_LISTS : l] === null) ? "error" : "loading";
  };
  const retry = () => {
    const failed = Object.keys(loaded).filter((l) => loaded[l] === null);
    for (const l of failed) requested.current.delete(l);
    setLoaded((l) => Object.fromEntries(Object.entries(l).filter(([k]) => !failed.includes(k))));
    setAttempt((a) => a + 1);
  };
  return { spells, status, retry };
}
