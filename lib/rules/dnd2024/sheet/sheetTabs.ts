export type SheetTabId = "acciones" | "conjuros" | "inventario" | "rasgos" | "trasfondo" | "notas";

// Ids de pestañas anteriores, para que los enlaces viejos (`?tab=info`, `?tab=equipo`) sigan funcionando
const LEGACY: Record<string, SheetTabId> = { info: "acciones", equipo: "inventario" };

// Pestaña a mostrar según `?tab=`: traduce los ids antiguos y, si es desconocida o no está disponible, Acciones
export function normalizeSheetTab(raw: unknown, available: SheetTabId[]): SheetTabId {
  const id = typeof raw === "string" ? (LEGACY[raw] ?? raw) : raw;
  return available.find((t) => t === id) ?? "acciones";
}
