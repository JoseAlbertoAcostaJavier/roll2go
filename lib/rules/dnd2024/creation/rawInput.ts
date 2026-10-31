// Comprobaciones de forma de lo que envía el cliente, compartidas por la validación de la hoja y de las elecciones.
import type { Ref } from "@/lib/rules/types";

export type Obj = Record<string, unknown>;
export const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
export const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
export const isStringList = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((s) => typeof s === "string") && new Set(v).size === v.length;
// Referencia del cliente: `{ book, key }` o un `Named` (`{ ref: { book, key }, name }`)
export const asRef = (v: unknown): Ref | null => {
  const r = isObj(v) && isObj(v.ref) ? v.ref : v;
  return isObj(r) && typeof r.book === "string" && typeof r.key === "string" ? { book: r.book, key: r.key } : null;
};
