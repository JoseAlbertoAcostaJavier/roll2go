"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

export default function LocalDate({
  iso,
  withTime = true,
  timeOnly = false,
}: {
  iso: string;
  withTime?: boolean;
  timeOnly?: boolean;
}) {
  const text = useSyncExternalStore(
    noop,
    // En el navegador: zona horaria e idioma del usuario
    () => {
      const d = new Date(iso);
      return timeOnly
        ? new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(d)
        : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", ...(withTime ? { timeStyle: "short" as const } : {}) }).format(d);
    },
    // En el servidor, en UTC (al cargar la página en el navegador se cambia a la hora local)
    () => {
      const d = new Date(iso);
      return timeOnly
        ? new Intl.DateTimeFormat("es-ES", { timeStyle: "short", timeZone: "UTC" }).format(d)
        : new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "UTC" }).format(d);
    },
  );
  return <time dateTime={iso}>{text}</time>;
}