// Lista de pestañas de la ficha. Sin "use client": la página (servidor) la lee y `SheetTabs` (cliente) la pinta.
import { Backpack, BookUser, NotebookPen, Sparkles, Swords, WandSparkles } from "lucide-react";
import type { SheetTabId } from "@/lib/rules/dnd2024/sheet/sheetTabs";

export const SHEET_TABS = [
  { id: "acciones", label: "Combate", icon: Swords },
  { id: "conjuros", label: "Conjuros", icon: WandSparkles },
  { id: "inventario", label: "Inventario", icon: Backpack },
  { id: "rasgos", label: "Rasgos y dotes", icon: Sparkles },
  { id: "notas", label: "Notas", icon: NotebookPen },
  { id: "trasfondo", label: "Trasfondo", icon: BookUser },
] as const satisfies readonly { id: SheetTabId; label: string; icon: unknown }[];

export type SheetTab = SheetTabId;
