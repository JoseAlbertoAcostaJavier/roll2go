// Formas del catálogo de reglas que comparten el servidor (lib/server/catalog) y el navegador. Módulo puro.
import type { Ref, SpellData } from "@/lib/rules/types";

export type BookOption = {
  id: string;
  key: string;
  systemId: string;
  name: string;
  license: "own" | "srd" | "official";
  attribution: string;
};

export type EntryOption = {
  ref: Ref;
  name: string;
  nameEs: string | null;
  bookName: string;
  srd52: boolean;
  data: unknown;
};

export type CatalogEntry = EntryOption & {
  description: string;
  descriptionEs: string;
  identifier: string;
  /** Página en el libro (5etools); `null` en las entradas sin página o importadas antes de guardarla. */
  page: number | null;
  parent: Ref | null;
  foundry: unknown;
};

/** Conjuro del listado de la ficha: con sus datos (sin la mejora) y la línea de resumen, sin la descripción. */
export type SpellOption = EntryOption & { data: SpellData; summary: string };
