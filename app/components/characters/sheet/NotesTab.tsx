import type { Dnd2024SheetV2 } from "@/lib/rules/dnd2024/sheet/sheet";
import { InlineText } from "./InlineText";
import { SectionBar } from "./statUi";

// Pestaña Notas (spec de rasgos §5): organizaciones, aliados, enemigos y otras notas, editables en el sitio por el dueño
export default function NotesTab({ characterId, isOwner, sheet }: { characterId: string; isOwner: boolean; sheet: Dnd2024SheetV2 }) {
  const fields = [
    { field: "organizations", label: "Organizaciones", value: sheet.organizations },
    { field: "allies", label: "Aliados", value: sheet.allies },
    { field: "enemies", label: "Enemigos", value: sheet.enemies },
    { field: "notes", label: "Otras notas", value: sheet.notes },
  ] as const;

  return (
    <div className="animate-fade-up space-y-4">
      {fields.map((f) => (
        <section key={f.field} aria-label={f.label} className="space-y-2">
          <SectionBar title={f.label} />
          <div className="px-3">
            <InlineText
              characterId={characterId}
              field={f.field}
              label={f.label}
              value={f.value ?? ""}
              multiline
              editable={isOwner}
              hideLabel
            />
          </div>
        </section>
      ))}
    </div>
  );
}
