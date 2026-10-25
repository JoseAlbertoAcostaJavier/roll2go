import "server-only";
import { NextResponse } from "next/server";

/* Resultado de un servicio: { ok: true, ...datos } o el fallo con su código HTTP. El fallo lleva un mensaje (`error`)
   o los errores por campo de un formulario (`errors`, siempre con 400); la ruta lo traduce con failureResponse. */
export type Failure =
  | { ok: false; status: number; error: string; errors?: undefined }
  | { ok: false; status: 400; errors: Record<string, string>; error?: undefined };
export type Result<T extends object = object> = ({ ok: true } & T) | Failure;

export const fail = (status: number, error: string): Failure => ({ ok: false, status, error });
export const invalid = (errors: Record<string, string>): Failure => ({ ok: false, status: 400, errors });

// Respuesta de un fallo: { error } o { errors }, con su código
export const failureResponse = (f: Failure) =>
  NextResponse.json(f.errors ? { errors: f.errors } : { error: f.error }, { status: f.status });
