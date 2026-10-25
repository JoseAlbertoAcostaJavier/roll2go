// "hace 5 minutos", "ayer"... (solo para usarse en el navegador)
export function timeAgo(iso: string, now = Date.now()) {
  const diff = Math.round((new Date(iso).getTime() - now) / 1000); // negativo = pasado
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  if (abs < 60) return "ahora mismo";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 7 * 86400) return rtf.format(Math.round(diff / 86400), "day");
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(iso),
  );
}
