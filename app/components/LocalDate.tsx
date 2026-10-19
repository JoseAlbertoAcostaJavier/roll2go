"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

export default function LocalDate({ iso, withTime = true }: { iso: string; withTime?: boolean }) {
  const text = useSyncExternalStore(
    noop,
    // En el navegador: zona horaria e idioma del usuario
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        ...(withTime ? { timeStyle: "short" as const } : {}),
      }).format(new Date(iso)),
    // En el servidor: solo la fecha, en UTC
    () => new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(iso)),
  );
  return <time dateTime={iso}>{text}</time>;
}