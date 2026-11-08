import { toolName } from "@/lib/rules/dnd2024/sheet/labels";
import MobileCollapse from "./MobileCollapse";
import { sheetSideBox } from "./statUi";
import type { SheetData } from "./types";

// Herramientas con las que el personaje es competente
export default function ToolsBox({ tools, className = "" }: { tools: SheetData["tools"]; className?: string }) {
  return (
    <section className={`${sheetSideBox} ${className}`}>
      <MobileCollapse title="Herramientas">
        {tools.length === 0 ? <p className="text-sm text-muted">Sin herramientas</p> : (
          <ul className="space-y-1.5 text-sm font-semibold text-fg">
            {tools.map((t) => <li key={t}>{toolName(t)}</li>)}
          </ul>
        )}
      </MobileCollapse>
    </section>
  );
}
